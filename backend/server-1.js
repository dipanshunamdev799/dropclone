
// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');

const app = express();

// AWS Configuration
AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

// Middleware
app.use(cors());
app.use(express.json());

// Multer S3 configuration for file uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const fileId = uuidv4();
      const key = `${req.userId}/${fileId}-${file.originalname}`;
      cb(null, key);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ============================================
// AUTH MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const params = {
      AccessToken: token
    };
    const user = await cognito.getUser(params).promise();
    req.userId = user.Username;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name }
      ]
    };
    
    await cognito.signUp(params).promise();
    res.json({ 
      message: 'User registered successfully. Please check your email for verification.' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };
    
    const result = await cognito.initiateAuth(params).promise();
    res.json({
      token: result.AuthenticationResult.AccessToken,
      refreshToken: result.AuthenticationResult.RefreshToken,
      expiresIn: result.AuthenticationResult.ExpiresIn
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Verify user email
app.post('/api/auth/verify', async (req, res) => {
  const { email, code } = req.body;
  
  try {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code
    };
    
    await cognito.confirmSignUp(params).promise();
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Resend verification code
app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email
    };

    await cognito.resendConfirmationCode(params).promise();
    res.json({ message: 'Verification code resent successfully. Please check your email.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// FILE MANAGEMENT ROUTES
// ============================================

// Upload file
app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const fileData = {
      userId: req.userId,
      fileId: fileId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      s3Key: req.file.key,
      s3Location: req.file.location,
      versionId: req.file.versionId,
      mimeType: req.file.mimetype,
      uploadDate: new Date().toISOString(),
      isPublic: false,
      downloadCount: 0
    };

    // Store metadata in DynamoDB
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE,
      Item: fileData
    }).promise();

    res.json({ 
      message: 'File uploaded successfully',
      file: fileData
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all files for authenticated user
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.query({
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': req.userId
      },
      ScanIndexForward: false // Sort by newest first
    }).promise();

    res.json({ 
      files: result.Items,
      count: result.Count
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single file details
app.get('/api/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file: result.Item });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file (generate presigned URL)
app.get('/api/files/download/:fileId', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate presigned URL valid for 1 hour
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: result.Item.s3Key,
      Expires: 3600,
      ResponseContentDisposition: `attachment; filename="${result.Item.fileName}"`
    });

    // Increment download count
    await dynamodb.update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      },
      UpdateExpression: 'SET downloadCount = if_not_exists(downloadCount, :zero) + :inc',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1
      }
    }).promise();

    res.json({ 
      downloadUrl: url,
      fileName: result.Item.fileName,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file versions (S3 versioning)
app.get('/api/files/:fileId/versions', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get all versions from S3
    const versions = await s3.listObjectVersions({
      Bucket: process.env.S3_BUCKET,
      Prefix: result.Item.s3Key
    }).promise();

    res.json({ 
      versions: versions.Versions,
      currentVersion: result.Item.versionId
    });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file
app.delete('/api/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from S3 (all versions if versioning is enabled)
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET,
      Key: result.Item.s3Key
    }).promise();

    // Delete metadata from DynamoDB
    await dynamodb.delete({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FILE SHARING ROUTES
// ============================================

// Create shareable link
app.post('/api/files/share/:fileId', authenticateToken, async (req, res) => {
  try {
    const { expiresIn = 86400 } = req.body; // Default 24 hours in seconds

    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate presigned URL for sharing
    const shareUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: result.Item.s3Key,
      Expires: expiresIn
    });

    const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update file metadata with share info
    await dynamodb.update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      },
      UpdateExpression: 'SET isPublic = :isPublic, lastShared = :now, shareExpiry = :expiry',
      ExpressionAttributeValues: {
        ':isPublic': true,
        ':now': new Date().toISOString(),
        ':expiry': expiryDate
      }
    }).promise();

    res.json({ 
      shareUrl,
      expiresAt: expiryDate,
      expiresIn: expiresIn
    });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Revoke share link
app.post('/api/files/unshare/:fileId', authenticateToken, async (req, res) => {
  try {
    await dynamodb.update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        userId: req.userId,
        fileId: req.params.fileId
      },
      UpdateExpression: 'SET isPublic = :isPublic REMOVE shareUrl, shareExpiry',
      ExpressionAttributeValues: {
        ':isPublic': false
      }
    }).promise();

    res.json({ message: 'Share link revoked successfully' });
  } catch (error) {
    console.error('Unshare error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UTILITY ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get storage stats for user
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.query({
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': req.userId
      }
    }).promise();

    const totalSize = result.Items.reduce((sum, file) => sum + (file.fileSize || 0), 0);
    const totalFiles = result.Count;

    res.json({
      totalFiles,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   DropClone Backend Server Started    ║
  ╠═══════════════════════════════════════╣
  ║   Port: ${PORT}                          ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}         ║
  ║   Region: ${process.env.AWS_REGION}              ║
  ╚═══════════════════════════════════════╝
  `);
});
