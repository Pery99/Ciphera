import { useEffect } from "react";
import { X } from "lucide-react";

type MediaLightboxProps = {
  url: string;
  kind: "image" | "video";
  onClose: () => void;
};

export function MediaLightbox({ url, kind, onClose }: MediaLightboxProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="media-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="media-lightbox-close tap-spring" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
      <div className="media-lightbox-stage" onClick={(event) => event.stopPropagation()}>
        {kind === "image" ? (
          <img src={url} alt="Shared image" className="media-lightbox-image" />
        ) : (
          <video src={url} className="media-lightbox-video" controls autoPlay playsInline />
        )}
      </div>
    </div>
  );
}