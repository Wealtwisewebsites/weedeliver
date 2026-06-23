import { useState, useRef } from "react";
import { Upload, RefreshCw } from "lucide-react";

export const ImageUploadBox = ({ current, onUpload, label, className = "", aspectHint = "", folder = "uploads" }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const handleClick = () => !uploading && inputRef.current?.click();

  const handleFile = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { uploadImage } = await import("../supabase.js");
      const result = await uploadImage(file, folder);
      if (result.url) {
        onUpload(result.url);
      } else {
        console.warn("Supabase upload failed, falling back to base64:", result.error);
        const reader = new FileReader();
        reader.onload = () => onUpload(reader.result);
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setError(err.message);
      const reader = new FileReader();
      reader.onload = () => onUpload(reader.result);
      reader.readAsDataURL(file);
    }
    setUploading(false);
  };

  return (
    <div className={`relative cursor-pointer ${className}`} onClick={handleClick}>
      {current ? (
        <>
          <img src={current} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white flex items-center gap-1 shadow-lg">
            {uploading ? <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading...</> : <><Upload className="w-3 h-3" /> Change</>}
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl active:bg-gray-100 transition-colors">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
            {uploading ? <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 animate-spin" /> : <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-gray-500">{uploading ? "Uploading..." : label}</span>
          {aspectHint && !uploading && <span className="text-[10px] text-gray-400 mt-0.5">{aspectHint}</span>}
          {!uploading && <span className="text-[10px] text-green-600 font-medium mt-1">Tap to upload</span>}
        </div>
      )}
      {error && <div className="absolute top-2 left-2 right-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded">{error}</div>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

export default ImageUploadBox;
