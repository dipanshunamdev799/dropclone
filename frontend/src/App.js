import React, { useState, useEffect } from 'react';
import { Upload, Download, Share2, Trash2, Clock, FileText, LogOut } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [files, setFiles] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareDialog, setShareDialog] = useState(null);

  useEffect(() => {
    if (token) {
      fetchFiles();
    }
  }, [token]);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (isRegister) {
          alert('Registration successful! Please login.');
          setIsRegister(false);
        } else {
          setToken(data.token);
          localStorage.setItem('token', data.token);
        }
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchFiles();
        alert('File uploaded successfully!');
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await fetch(`${API_URL}/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      alert('Error downloading file');
    }
  };

  const handleShare = async (fileId) => {
    try {
      const res = await fetch(`${API_URL}/files/share/${fileId}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 86400 })
      });
      
      const data = await res.json();
      setShareDialog({ url: data.shareUrl, expiresAt: data.expiresAt });
    } catch (err) {
      alert('Error creating share link');
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const res = await fetch(`${API_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchFiles();
        alert('File deleted successfully');
      }
    } catch (err) {
      alert('Error deleting file');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-indigo-600 rounded-full mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">DropClone</h1>
            <p className="text-gray-600 mt-2">Your secure cloud storage</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            )}
            
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              {isRegister ? 'Register' : 'Login'}
            </button>
          </form>

          <p className="text-center mt-6 text-gray-600">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="ml-2 text-indigo-600 font-semibold hover:underline"
            >
              {isRegister ? 'Login' : 'Register'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-800">DropClone</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition">
            <div className="flex flex-col items-center">
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
            </div>
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Files List */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Your Files ({files.length})</h2>
          
          {files.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.fileId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <div className="flex items-center space-x-4 flex-1">
                    <FileText className="w-8 h-8 text-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{file.fileName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.fileSize)} • {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(file.fileId, file.fileName)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleShare(file.fileId)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Share"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.fileId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Share Dialog */}
      {shareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <Share2 className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold">Share Link Created</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Anyone with this link can download the file. The link will expire in 24 hours.
            </p>
            
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-xs text-gray-500 mb-1">Share URL:</p>
              <p className="text-sm text-gray-800 break-all">{shareDialog.url}</p>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
              <Clock className="w-4 h-4" />
              <span>Expires: {new Date(shareDialog.expiresAt).toLocaleString()}</span>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareDialog.url);
                  alert('Link copied to clipboard!');
                }}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShareDialog(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}