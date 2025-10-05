import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Upload, Download, Share2, Trash2, Clock, FileText, LogOut, 
  Copy, Check, FileImage, FileArchive, FileJson, Loader2, MailCheck, X
} from 'lucide-react';

const API_URL = '/api';

const getFileIcon = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) {
    return <FileImage className="w-8 h-8 text-blue-500" />;
  }
  if (['zip', 'rar', '7z', 'tar.gz'].includes(extension)) {
    return <FileArchive className="w-8 h-8 text-yellow-500" />;
  }
  if (['json', 'js', 'css', 'html'].includes(extension)) {
    return <FileJson className="w-8 h-8 text-green-500" />;
  }
  return <FileText className="w-8 h-8 text-indigo-500" />;
};


export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [files, setFiles] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // FIXED: Using a 'view' state for explicit UI control
  const [view, setView] = useState(token ? 'dashboard' : 'auth');
  const [code, setCode] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareDialog, setShareDialog] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // This effect now correctly synchronizes the view state with the token state
  useEffect(() => {
    if (token) {
      fetchFiles();
      setView('dashboard');
    } else {
      setView('auth');
    }
  }, [token]);

  // Timer for resend code button
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setResending(false);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}/files`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      toast.error('Failed to fetch files.');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: isRegister ? name : undefined })
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegister) {
          toast.success('Registration successful! Please check your email for the code.');
          setView('verify');
        } else {
          setToken(data.token);
          localStorage.setItem('token', data.token);
          toast.success('Logged in successfully!');
        }
      } else {
        if (!isRegister && data.error && data.error.toLowerCase().includes('user is not confirmed')) {
          toast.error('Your account is not verified. Please enter the code from your email.');
          setView('verify');
        } else {
          toast.error(data.error || 'Authentication failed');
        }
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Email verified! Please login.');
        setView('auth');
        setIsRegister(false);
        setCode('');
      } else { throw new Error(data.error || 'Verification failed'); }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resending) return;
    setResending(true);
    const toastId = toast.loading('Resending code...');
    try {
      const res = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Verification code resent.', { id: toastId });
        setCountdown(60);
      } else { throw new Error(data.error || 'Failed to resend'); }
    } catch (err) {
      toast.error(err.message, { id: toastId });
      setResending(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const toastId = toast.loading('Uploading file...');
    try {
      const res = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        fetchFiles();
        toast.success('File uploaded successfully!', { id: toastId });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Upload failed', { id: toastId });
      }
    } catch (err) {
      toast.error('Error uploading file', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId) => {
    const toastId = toast.loading('Preparing download...');
    try {
      const res = await fetch(`${API_URL}/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        window.open(data.downloadUrl, '_blank');
        toast.success('Download started!', { id: toastId });
      } else {
        throw new Error(data.error || 'Could not get download link');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
  };

  const handleShare = async (fileId) => {
    const toastId = toast.loading('Creating share link...');
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
      if(res.ok) {
        setShareDialog({ url: data.shareUrl, expiresAt: data.expiresAt });
        toast.success('Share link created!', { id: toastId });
      } else {
        throw new Error(data.error || 'Failed to create link');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
  };

  const handleConfirmDelete = () => {
    if (!fileToDelete) return;
    const originalFiles = [...files];
    const fileId = fileToDelete;

    // Optimistic UI update
    setFiles(prevFiles => prevFiles.filter(f => f.fileId !== fileId));
    setFileToDelete(null);

    const promise = fetch(`${API_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (!res.ok) {
        return res.json().then(data => {
          throw new Error(data.error || 'Deletion failed');
        });
      }
      return 'File deleted successfully';
    });

    toast.promise(promise, {
      loading: 'Deleting file...',
      success: (msg) => msg,
      error: (err) => {
        // On error, revert the UI change
        setFiles(originalFiles);
        return err.message;
      },
    });
  };

  const handleLogout = () => {
    toast.success('You have been logged out.');
    setToken(null);
    localStorage.removeItem('token');
    setFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const AuthView = () => (
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
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required/>
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" required />
          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center disabled:bg-indigo-400 disabled:cursor-not-allowed">
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isLoading ? (isRegister ? 'Registering...' : 'Logging in...') : (isRegister ? 'Register' : 'Login')}
          </button>
        </form>
        <p className="text-center mt-6 text-gray-600">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setIsRegister(!isRegister)} className="ml-2 text-indigo-600 font-semibold hover:underline">
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );

  const VerifyView = () => (
     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-block p-3 bg-green-600 rounded-full mb-4">
                <MailCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800">Verify Your Account</h1>
              <p className="text-gray-600 mt-2">A code has been sent to <span className="font-semibold text-gray-700">{email}</span>.</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <input type="text" placeholder="Verification Code" value={code} onChange={(e) => setCode(e.target.value)} className="w-full text-center tracking-widest text-lg px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" required />
              <button type="submit" disabled={isLoading} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center disabled:bg-green-400 disabled:cursor-not-allowed">
                {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
             <div className="text-center mt-6 text-gray-600">
              <p>Didn't get the code?
                <button onClick={handleResendCode} disabled={resending} className="ml-2 text-indigo-600 font-semibold hover:underline disabled:text-gray-400 disabled:cursor-not-allowed">
                  {resending ? `Resend in ${countdown}s` : 'Resend'}
                </button>
              </p>
               <button onClick={() => setView('auth')} className="mt-4 text-sm text-gray-500 hover:text-indigo-600">
                 Back to Login
               </button>
            </div>
          </div>
    </div>
  );

  const DashboardView = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-800">DropClone</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload New File</h2>
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-indigo-500 transition-all duration-300">
            <div className="flex flex-col items-center text-center">
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : <><span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop</>}
              </p>
              <p className="text-xs text-gray-500 mt-1">Max file size: 50MB</p>
            </div>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading}/>
          </label>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Files ({files.length})</h2>
          {files.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <FileText className="w-20 h-20 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No files uploaded yet.</p>
              <p className="text-sm">Use the uploader above to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.fileId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {getFileIcon(file.fileName)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate" title={file.fileName}>{file.fileName}</h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.fileSize)} • Uploaded: {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <button onClick={() => handleDownload(file.fileId)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200" title="Download">
                      <Download className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleShare(file.fileId)} className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-all duration-200" title="Share">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => setFileToDelete(file.fileId)} className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Modals */}
      {shareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <Share2 className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-semibold text-gray-800">Share Link Created</h3>
                </div>
                <button onClick={() => setShareDialog(null)} className="p-1 text-gray-400 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg flex justify-between items-center">
              <p className="text-sm text-indigo-700 break-all font-mono mr-2">{shareDialog.url}</p>
              <button onClick={() => handleCopy(shareDialog.url)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg flex-shrink-0">
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mt-4">
              <Clock className="w-4 h-4" />
              <span>Expires: {new Date(shareDialog.expiresAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in-up">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-3">Delete File</h3>
              <div className="mt-2 px-4 py-3">
                <p className="text-sm text-gray-600">Are you sure you want to delete this file? This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-4 flex space-x-3">
                <button type="button" onClick={() => setFileToDelete(null)} className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-all duration-200">Cancel</button>
                <button type="button" onClick={handleConfirmDelete} className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      {view === 'auth' && <AuthView />}
      {view === 'verify' && <VerifyView />}
      {view === 'dashboard' && <DashboardView />}
    </>
  );
}

