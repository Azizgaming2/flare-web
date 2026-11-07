import { useEffect, useState } from "react";
import { fetchClassFile } from "../../api/classApi";
import { formatBytes } from "../../utils";

export default function ClassAttachment({ code, file }) {
  const isImage = file.mime.startsWith("image/");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!isImage) return undefined;
    let live = true;
    let made = "";
    fetchClassFile(code, file.id)
      .then((blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [code, file.id, isImage]);

  async function download() {
    try {
      const blob = await fetchClassFile(code, file.id);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } catch {
      return;
    }
  }

  if (isImage) {
    return url ? <img className="cl-img" src={url} alt={file.name} /> : <div className="cl-file">{file.name}</div>;
  }
  return (
    <button type="button" className="cl-file" onClick={download}>
      <span>{file.name}</span>
      <small>{formatBytes(file.size)}</small>
    </button>
  );
}
