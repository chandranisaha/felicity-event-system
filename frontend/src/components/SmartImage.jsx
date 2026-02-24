import { useMemo, useState } from "react";
import { getImageCandidates } from "../lib/media";

const SmartImage = ({ src, alt, className = "", ...rest }) => {
  const candidates = useMemo(() => getImageCandidates(src), [src]);
  const [index, setIndex] = useState(0);
  const activeSrc = candidates[index] || "";

  if (!activeSrc) return null;

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => {
        setIndex((prev) => {
          if (prev + 1 < candidates.length) return prev + 1;
          return prev;
        });
      }}
      {...rest}
    />
  );
};

export default SmartImage;
