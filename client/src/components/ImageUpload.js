import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Tag, Plus } from 'lucide-react';
import { toast } from 'react-toastify';

const ImageUpload = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      title: '',
      description: '',
      tags: [...tags],
      id: Math.random().toString(36).substr(2, 9)
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, [tags]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.tiff', '.webp']
    },
    multiple: true
  });

  const removeFile = (id) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      // Clean up preview URLs
      const removed = prev.find(f => f.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  const updateFileMetadata = (id, field, value) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const addFileTag = (fileId, tag) => {
    if (!tag.trim()) return;
    
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, tags: [...new Set([...f.tags, tag.trim()])] }
        : f
    ));
  };

  const removeFileTag = (fileId, tagToRemove) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, tags: f.tags.filter(tag => tag !== tagToRemove) }
        : f
    ));
  };

  const addGlobalTag = () => {
    if (!currentTag.trim() || tags.includes(currentTag.trim())) return;
    
    const newTag = currentTag.trim();
    setTags(prev => [...prev, newTag]);
    setCurrentTag('');
    
    // Add to all existing files
    setFiles(prev => prev.map(f => ({
      ...f,
      tags: [...new Set([...f.tags, newTag])]
    })));
  };

  const removeGlobalTag = (tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
    
    // Remove from all files
    setFiles(prev => prev.map(f => ({
      ...f,
      tags: f.tags.filter(tag => tag !== tagToRemove)
    })));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const fileData of files) {
      try {
        const formData = new FormData();
        formData.append('image', fileData.file);
        formData.append('title', fileData.title);
        formData.append('description', fileData.description);
        formData.append('tags', JSON.stringify(fileData.tags));

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        successCount++;
        
        // Clean up preview URL
        URL.revokeObjectURL(fileData.preview);
        
      } catch (error) {
        console.error(`Error uploading ${fileData.file.name}:`, error);
        toast.error(`Failed to upload ${fileData.file.name}: ${error.message}`);
      }
    }

    setUploading(false);
    
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} of ${files.length} images`);
      setFiles([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Tags */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Default Tags</h3>
        <p className="text-gray-600 text-sm mb-4">
          These tags will be applied to all uploaded images
        </p>
        
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Tag className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Add a tag..."
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addGlobalTag()}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={addGlobalTag}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              {tag}
              <button
                onClick={() => removeGlobalTag(tag)}
                className="hover:bg-blue-200 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* File Drop Zone */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div
          {...getRootProps()}
          className={`dropzone ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop files here...</p>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 font-medium mb-2">
                Drag & drop images here, or click to select
              </p>
              <p className="text-gray-500 text-sm">
                Supports JPEG, PNG, GIF, BMP, TIFF, WebP
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">
              Files to Upload ({files.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setFiles([])}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
              <button
                onClick={uploadFiles}
                disabled={uploading}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="spinner w-4 h-4"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload All
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {files.map(fileData => (
              <FilePreview
                key={fileData.id}
                fileData={fileData}
                onRemove={() => removeFile(fileData.id)}
                onUpdateMetadata={(field, value) => updateFileMetadata(fileData.id, field, value)}
                onAddTag={(tag) => addFileTag(fileData.id, tag)}
                onRemoveTag={(tag) => removeFileTag(fileData.id, tag)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FilePreview = ({ 
  fileData, 
  onRemove, 
  onUpdateMetadata, 
  onAddTag, 
  onRemoveTag 
}) => {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex gap-4">
        {/* Image Preview */}
        <div className="flex-shrink-0">
          <img
            src={fileData.preview}
            alt={fileData.file.name}
            className="w-24 h-24 object-cover rounded-lg"
          />
        </div>

        {/* Metadata Form */}
        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-start">
            <h4 className="font-medium text-gray-900 truncate">
              {fileData.file.name}
            </h4>
            <button
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Title (optional)"
              value={fileData.title}
              onChange={(e) => onUpdateMetadata('title', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={fileData.description}
              onChange={(e) => onUpdateMetadata('description', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Add
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {fileData.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center gap-1"
                >
                  {tag}
                  <button
                    onClick={() => onRemoveTag(tag)}
                    className="hover:bg-blue-200 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Size: {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload; 