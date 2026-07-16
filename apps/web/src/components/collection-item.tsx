import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { CollectionItem as CollectionItemType } from "../types.js";

type CollectionItemProps = {
  item: CollectionItemType;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CollectionItem({ item, checked, onChange }: CollectionItemProps) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className={`collection-item${checked ? " collection-item--selected" : ""}`}>
      <div className="collection-item__media">
        {item.imageUrl && !imageFailed ? (
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? ""}
            width="360"
            height="240"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="image-fallback" role="img" aria-label={`No image available for ${item.title}`}>
            <ImageOff aria-hidden="true" size={26} />
          </div>
        )}
      </div>
      <div className="collection-item__body">
        <label className="item-check">
          <input
            type="checkbox"
            name="itemIds"
            value={item.id}
            checked={checked}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
          <span>
            <strong>{item.title}</strong>
            <span>{item.source}</span>
          </span>
        </label>
        {item.note ? <p className="collection-item__note">{item.note}</p> : null}
      </div>
    </article>
  );
}
