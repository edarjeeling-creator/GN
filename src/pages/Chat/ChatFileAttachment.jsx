import React, { useState, useEffect } from 'react';
import { getAttachmentUrl } from '../../lib/chat_storage';
import { File, Download, Loader2, Image as ImageIcon } from 'lucide-react';

const ChatFileAttachment = ({ metadata, isMine }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchUrl = async () => {
      if (metadata?.file_path) {
        setLoading(true);
        const signedUrl = await getAttachmentUrl(metadata.file_path);
        if (isMounted && signedUrl) {
          setUrl(signedUrl);
        }
        if (isMounted) setLoading(false);
      }
    };
    fetchUrl();
    return () => { isMounted = false; };
  }, [metadata]);

  if (!metadata) return null;

  const isImage = metadata.file_type?.startsWith('image/');
  const fileName = metadata.file_name || 'Attachment';
  const fileSize = metadata.file_size ? (metadata.file_size / 1024 / 1024).toFixed(2) + ' MB' : '';

  if (isImage) {
    return (
      <div className="mt-2 mb-1 max-w-sm overflow-hidden rounded-lg border border-gray-200/50 relative group">
        {loading ? (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center animate-pulse">
            <Loader2 className="animate-spin text-gray-400" />
          </div>
        ) : url ? (
          <>
            <img src={url} alt={fileName} className="w-full object-cover max-h-64 cursor-pointer" onClick={() => window.open(url, '_blank')} />
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              download={fileName}
              className={`absolute bottom-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70`}
            >
              <Download size={16} />
            </a>
          </>
        ) : (
          <div className="w-full h-32 bg-gray-100 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon size={32} className="mb-2 opacity-50" />
            <span className="text-xs">Image unavailable</span>
          </div>
        )}
      </div>
    );
  }

  // Document / other files
  return (
    <div className={`mt-2 mb-1 flex items-center gap-3 p-3 rounded-lg border ${isMine ? 'bg-blue-700/30 border-blue-600/50' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`p-2 rounded-md ${isMine ? 'bg-blue-600' : 'bg-white shadow-sm'}`}>
        <File size={24} className={isMine ? 'text-white' : 'text-blue-500'} />
      </div>
      <div className="overflow-hidden flex-1">
        <p className={`text-sm font-medium truncate ${isMine ? 'text-white' : 'text-gray-800'}`} title={fileName}>
          {fileName}
        </p>
        <p className={`text-xs ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>
          {fileSize} {metadata.file_type ? `• ${metadata.file_type.split('/').pop().toUpperCase()}` : ''}
        </p>
      </div>
      {loading ? (
        <Loader2 className={`animate-spin ${isMine ? 'text-white' : 'text-gray-400'}`} size={20} />
      ) : url ? (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          download={fileName}
          className={`p-2 rounded-full transition-colors ${isMine ? 'hover:bg-blue-600 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
        >
          <Download size={20} />
        </a>
      ) : null}
    </div>
  );
};

export default ChatFileAttachment;
