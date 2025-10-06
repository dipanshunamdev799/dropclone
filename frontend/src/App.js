import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload, Download, Share2, Trash2, Clock, FileText, LogOut,Mail,Lock,User,KeyRound,
  Copy, Check, FileImage, FileArchive, FileJson, Loader2, X
} from 'lucide-react';
import './App.css'; // Import the new CSS file

// =================================================================================
// CONSTANTS
// =================================================================================
const API_BASE_URL = '/api';
const AUTH_TOKEN_KEY = 'dropclone_auth_token';

// =================================================================================
// UTILITY FUNCTIONS
// =================================================================================

const getFileIcon = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  const baseClass = "file-icon";

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
    return <FileImage className={`${baseClass} icon-image`} />;
  }
  if (['zip', 'rar', '7z', 'tar.gz'].includes(extension)) {
    return <FileArchive className={`${baseClass} icon-archive`} />;
  }
  if (['json', 'js', 'css', 'html', 'jsx', 'ts'].includes(extension)) {
    return <FileJson className={`${baseClass} icon-json`} />;
  }
  return <FileText className={`${baseClass} icon-default`} />;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const copyToClipboard = (text) => {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(resolve).catch(reject);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) resolve();
        else reject(new Error('Copy command was unsuccessful'));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  });
};

// =================================================================================
// API CLIENT
// =================================================================================
const apiClient = async (endpoint, { body, ...customOptions } = {}) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customOptions,
    headers: {
      ...headers,
      ...customOptions.headers,
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
      config.headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An unknown API error occurred.' }));
      return Promise.reject(errorData.error || 'Request failed');
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return Promise.resolve();
    }
    return await response.json();
  } catch (error) {
    return Promise.reject(error.message || 'Network error');
  }
};


// =================================================================================
// UI COMPONENTS
// =================================================================================
const Header = memo(({ onLogout }) => (
  <header className="app-header">
    <div className="header-container">
      <div className="header-logo">
        <FileText className="logo-icon" />
        <h1>DropClone</h1>
      </div>
      <button onClick={onLogout} className="logout-button">
        <LogOut />
        <span>Logout</span>
      </button>
    </div>
  </header>
));

import {
  // ... your other lucide imports
  Mail, Lock, User, KeyRound // <-- Add these new icons
} from 'lucide-react';


const AuthForm = ({ onAuthSuccess }) => {
  const [view, setView] = useState('login'); // 'login', 'register', or 'verify'
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [verificationCode, setVerificationCode] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient('/auth/register', {
        body: { name: formData.name, email: formData.email, password: formData.password }
      });
      toast.success('Registration successful! Please check your email for a verification code.');
      setView('verify');
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await apiClient('/auth/login', {
        body: { email: formData.email, password: formData.password }
      });
      onAuthSuccess(data.token);
      toast.success('Logged in successfully!');
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient('/auth/verify', {
        body: { email: formData.email, code: verificationCode }
      });
      toast.success('Email verified successfully! You can now log in.');
      setView('login');
      setFormData({ name: '', email: formData.email, password: '' });
    } catch (error) {
      toast.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const toastId = toast.loading('Resending code...');
    try {
      await apiClient('/auth/resend-verification', {
        body: { email: formData.email }
      });
      toast.success('A new verification code has been sent.', { id: toastId });
    } catch (error) {
      toast.error(error, { id: toastId });
    }
  };
  
  // =================================================================================
  // ENHANCED JSX FOR AUTH FORMS
  // =================================================================================

  if (view === 'verify') {
    return (
      <div className="auth-page">
        <div className="auth-form-container">
          <div className="auth-header">
            {/* New: Added an icon to the verification header */}
            <div className="auth-logo-wrapper">
              <Mail className="auth-logo-icon" />
            </div>
            <h1>Check Your Email</h1>
            <p>We've sent a verification code to <strong>{formData.email}</strong></p>
          </div>
          <form onSubmit={handleVerify} className="auth-form">
            {/* New: Input with icon */}
            <div className="input-group">
              <KeyRound className="input-icon" />
              <input
                name="verificationCode"
                type="text"
                placeholder="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="auth-input"
                required
              />
            </div>
            <button type="submit" disabled={isLoading} className="auth-button">
              {isLoading && <Loader2 className="spinner" />}
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
          <p className="auth-toggle-text">
            Didn't receive a code?
            <button onClick={handleResendCode} className="auth-toggle-button">
              Resend Code
            </button>
          </p>
        </div>
      </div>
    );
  }

  const isRegister = view === 'register';

  return (
    <div className="auth-page">
      <div className="auth-form-container">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <FileText className="auth-logo-icon" />
          </div>
          <h1>{isRegister ? 'Create Account' : 'Welcome Back!'}</h1>
          <p>{isRegister ? 'Start your journey with us today.' : 'Sign in to continue to DropClone.'}</p>
        </div>
        <form onSubmit={isRegister ? handleRegister : handleLogin} className="auth-form">
          {isRegister && (
            // New: Input with icon
            <div className="input-group">
              <User className="input-icon" />
              <input name="name" type="text" placeholder="Full Name" value={formData.name} onChange={handleInputChange} className="auth-input" required />
            </div>
          )}
           {/* New: Input with icon */}
          <div className="input-group">
            <Mail className="input-icon" />
            <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} className="auth-input" required />
          </div>
           {/* New: Input with icon */}
          <div className="input-group">
            <Lock className="input-icon" />
            <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} className="auth-input" required />
          </div>
          <button type="submit" disabled={isLoading} className="auth-button">
            {isLoading && <Loader2 className="spinner" />}
            {isLoading ? (isRegister ? 'Creating Account...' : 'Signing In...') : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        <p className="auth-toggle-text">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setView(isRegister ? 'login' : 'register')} className="auth-toggle-button">
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};




const FileItem = memo(({ file, onDownload, onShare, onDelete }) => (
  <div className="file-item">
    <div className="file-info">
      {getFileIcon(file.fileName)}
      <div className="file-details">
        <h3 className="file-name" title={file.fileName}>{file.fileName}</h3>
        <p className="file-meta">
          {formatFileSize(file.fileSize)} • Uploaded: {new Date(file.uploadDate).toLocaleDateString()}
        </p>
      </div>
    </div>
    <div className="file-actions">
      <button onClick={() => onDownload(file.fileId)} className="action-button download" title="Download">
        <Download />
      </button>
      <button onClick={() => onShare(file.fileId)} className="action-button share" title="Share">
        <Share2 />
      </button>
      <button onClick={() => onDelete(file.fileId)} className="action-button delete" title="Delete">
        <Trash2 />
      </button>
    </div>
  </div>
));

const Modal = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close-button">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// =================================================================================
// MAIN APP COMPONENT
// =================================================================================
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [files, setFiles] = useState([]);
  const [appState, setAppState] = useState('loading');
  const [uploading, setUploading] = useState(false);
  const [shareDialog, setShareDialog] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      setAppState('loading');
      const data = await apiClient('/files');
      setFiles(data.files || []);
      setAppState('ready');
    } catch (err) {
      toast.error('Failed to fetch files.');
      setAppState('error');
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token, fetchFiles]);

  const handleAuthSuccess = useCallback((newToken) => {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    setToken(newToken);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setFiles([]);
    toast.success('You have been logged out.');
  }, []);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const toastId = toast.loading('Uploading file...');
    try {
      await apiClient('/files/upload', {
        method: 'POST',
        body: formData,
      });
      await fetchFiles();
      toast.success('File uploaded!', { id: toastId });
    } catch (error) {
      toast.error(error, { id: toastId });
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  }, [fetchFiles]);

  const handleDownload = useCallback(async (fileId) => {
    const toastId = toast.loading('Preparing download...');
    try {
      const data = await apiClient(`/files/download/${fileId}`);
      window.open(data.downloadUrl, '_blank');
      toast.success('Download started!', { id: toastId });
    } catch (error) {
      toast.error(error, { id: toastId });
    }
  }, []);

  const handleShare = useCallback(async (fileId) => {
    const toastId = toast.loading('Creating share link...');
    try {
      const data = await apiClient(`/files/share/${fileId}`, {
        body: { expiresIn: 86400 }
      });
      setShareDialog({ url: data.shareUrl, expiresAt: data.expiresAt });
      toast.success('Share link created!', { id: toastId });
    } catch (error) {
      toast.error(error, { id: toastId });
    }
  }, []);

  const handleDelete = useCallback((fileId) => {
    setFileToDelete(fileId);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!fileToDelete) return;

    const promise = apiClient(`/files/${fileToDelete}`, { method: 'DELETE' });

    toast.promise(promise, {
      loading: 'Deleting file...',
      success: () => {
        setFiles(prev => prev.filter(f => f.fileId !== fileToDelete));
        setFileToDelete(null);
        return 'File deleted!';
      },
      error: (err) => {
        setFileToDelete(null);
        return err;
      },
    });
  }, [fileToDelete]);

  const handleCopy = useCallback(() => {
    if (!shareDialog) return;
    copyToClipboard(shareDialog.url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy link.'));
  }, [shareDialog]);

  const fileList = useMemo(() => (
    files.map((file) => (
      <FileItem
        key={file.fileId}
        file={file}
        onDownload={handleDownload}
        onShare={handleShare}
        onDelete={handleDelete}
      />
    ))
  ), [files, handleDownload, handleShare, handleDelete]);

  if (!token) {
    return (
      <>
        <Toaster position="top-center" reverseOrder={false} />
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="app-container">
        <Header onLogout={handleLogout} />
        <main className="main-content">
          <div className="card">
            <h2 className="section-title">Upload New File</h2>
            <label className={`upload-label ${uploading ? 'disabled' : ''}`}>
              <div className="upload-label-content">
                <Upload />
                <p>
                  {uploading ? 'Uploading...' : <><span>Click to upload</span> or drag and drop</>}
                </p>
                <p className="upload-hint">Max file size: 50MB</p>
              </div>
              <input type="file" className="hidden-input" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <div className="card">
            <h2 className="section-title">Your Files ({files.length})</h2>
            {appState === 'loading' && (
              <div className="state-container">
                <Loader2 className="spinner large" />
                <p>Loading your files...</p>
              </div>
            )}
            {appState === 'ready' && files.length === 0 && (
              <div className="state-container">
                <FileText className="empty-state-icon" />
                <p className="empty-state-title">No files uploaded yet.</p>
                <p>Use the uploader above to get started!</p>
              </div>
            )}
            {appState === 'ready' && files.length > 0 && (
              <div className="file-list">{fileList}</div>
            )}
            {appState === 'error' && (
              <div className="state-container error-text">
                <p>Could not load files. Please try again later.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={!!shareDialog} onClose={() => setShareDialog(null)} title="Share File">
        <p className="modal-description">Anyone with this link can download the file. The link will expire automatically.</p>
        <div className="share-link-box">
          <p className="share-link-label">Share URL:</p>
          <p className="share-link-url">{shareDialog?.url}</p>
        </div>
        <div className="share-expiry-info">
          <Clock />
          <span>Expires: {new Date(shareDialog?.expiresAt).toLocaleString()}</span>
        </div>
        <button onClick={handleCopy} className="button primary full-width">
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </Modal>

      <Modal isOpen={!!fileToDelete} onClose={() => setFileToDelete(null)} title="Delete File">
        <div className="delete-confirm-content">
          <div className="delete-icon-wrapper">
            <Trash2 />
          </div>
          <p className="modal-description">Are you sure you want to delete this file? This action cannot be undone.</p>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={() => setFileToDelete(null)} className="button secondary">
            Cancel
          </button>
          <button type="button" onClick={handleConfirmDelete} className="button danger">
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}