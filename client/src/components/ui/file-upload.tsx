import React from "react";

interface FileUploadProps {
  multiple?: boolean;
  onFileChange: (files: File[]) => void;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ multiple = false, onFileChange, className }) => {
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      onFileChange(filesArray);
    }
  };

  return (
    <div className={`file-upload ${className}`}>
      <input
        type="file"
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
        id="file-upload-input"
      />
      <label
        htmlFor="file-upload-input"
        className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        Upload Files
      </label>
    </div>
  );
};

export { FileUpload };
