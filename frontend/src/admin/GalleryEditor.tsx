import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

import { ApiError, apiAssetUrl } from "../lib/api";
import type { GalleryItemContent, WeddingContent } from "../types/content";
import { uploadAdministratorMedia } from "./api";

type GalleryEditorProps = {
  accessToken: string;
  canManage: boolean;
  content: WeddingContent;
  setContent: Dispatch<SetStateAction<WeddingContent>>;
  onUploadingChange: (isUploading: boolean) => void;
};

export function GalleryEditor({
  accessToken,
  canManage,
  content,
  setContent,
  onUploadingChange,
}: GalleryEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function addImages(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setIsUploading(true);
    onUploadingChange(true);
    setErrorMessage("");
    setSuccessMessage("");
    const uploaded: GalleryItemContent[] = [];

    try {
      for (const file of files) {
        const response = await uploadAdministratorMedia(accessToken, file);
        uploaded.push({
          image: response.url,
          caption: "",
          alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
          visible: true,
        });
      }

      setContent((current) => ({
        ...current,
        galleryItems: [...current.galleryItems, ...uploaded],
      }));
      setSuccessMessage(
        `${uploaded.length} ${uploaded.length === 1 ? "photo" : "photos"} uploaded. Save website content to publish.`,
      );
    } catch (error) {
      if (uploaded.length) {
        setContent((current) => ({
          ...current,
          galleryItems: [...current.galleryItems, ...uploaded],
        }));
      }
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "One or more photos could not be uploaded.",
      );
    } finally {
      setIsUploading(false);
      onUploadingChange(false);
      event.target.value = "";
    }
  }

  function updateItem(index: number, changes: Partial<GalleryItemContent>): void {
    setContent((current) => ({
      ...current,
      galleryItems: current.galleryItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    }));
  }

  function moveItem(index: number, direction: -1 | 1): void {
    const destination = index + direction;
    if (destination < 0 || destination >= content.galleryItems.length) return;

    setContent((current) => {
      const items = [...current.galleryItems];
      [items[index], items[destination]] = [items[destination], items[index]];
      return { ...current, galleryItems: items };
    });
  }

  const visibleCount = content.galleryItems.filter((item) => item.visible).length;

  return (
    <section className="admin-content-card admin-gallery" aria-labelledby="gallery-editor-title">
      <div className="admin-content-panel-heading">
        <div>
          <h3 id="gallery-editor-title">Welcome gallery</h3>
          <p className="admin-content-help">
            {visibleCount} visible photos · {content.galleryItems.length} total photos
          </p>
        </div>
        {canManage ? (
          <label className="admin-gallery-upload">
            {isUploading ? "Uploading..." : "Add photos"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={addImages}
              disabled={isUploading}
            />
          </label>
        ) : null}
      </div>

      <p className="admin-content-help">
        Upload several JPEG, PNG, or WebP photos at once. Reorder them to control
        their position in the public welcome gallery.
      </p>
      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="admin-success" role="status">{successMessage}</p> : null}

      <div className="admin-gallery-grid">
        {content.galleryItems.map((item, index) => (
          <article
            className={`admin-gallery-card${item.visible ? "" : " is-hidden"}`}
            key={`${item.image}-${index}`}
          >
            <div className="admin-gallery-preview">
              <img
                src={apiAssetUrl(item.image)}
                alt={item.alt || `Gallery photo ${index + 1}`}
              />
              <span>Photo {index + 1}</span>
            </div>
            <label>
              Caption
              <input
                value={item.caption}
                maxLength={200}
                placeholder="Optional caption"
                onChange={(event) => updateItem(index, { caption: event.target.value })}
                disabled={!canManage}
              />
            </label>
            <label>
              Image description
              <input
                value={item.alt}
                maxLength={300}
                placeholder="Describe this photo"
                onChange={(event) => updateItem(index, { alt: event.target.value })}
                disabled={!canManage}
              />
            </label>
            <label className="admin-gallery-visible">
              <input
                type="checkbox"
                checked={item.visible}
                onChange={(event) => updateItem(index, { visible: event.target.checked })}
                disabled={!canManage}
              />
              Show on public website
            </label>
            {canManage ? (
              <div className="admin-gallery-actions">
                <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === content.galleryItems.length - 1}
                >
                  Move down
                </button>
                <button
                  className="is-danger"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      galleryItems: current.galleryItems.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {content.galleryItems.length === 0 ? (
          <p className="admin-table-message">No gallery photos yet. Add photos to begin.</p>
        ) : null}
      </div>
    </section>
  );
}
