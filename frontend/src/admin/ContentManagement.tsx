import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { ApiError, apiAssetUrl } from "../lib/api";
import { defaultWeddingContent, type WeddingContent } from "../types/content";
import { getAdministratorContent, updateAdministratorContent, uploadAdministratorMedia } from "./api";
import type { AdminRole } from "./types";

const giftKeys = ["gcash", "maya", "bank"] as const;

export function ContentManagement({ accessToken, role }: { accessToken: string; role: AdminRole }) {
  const [content, setContent] = useState<WeddingContent>(defaultWeddingContent);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHeroImages, setIsUploadingHeroImages] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canManage = role !== "viewer";

  useEffect(() => {
    let active = true;
    getAdministratorContent(accessToken)
      .then((response) => { if (active) setContent(response.content); })
      .catch((error) => { if (active) setErrorMessage(error instanceof ApiError ? error.message : "Wedding content could not be loaded."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await updateAdministratorContent(accessToken, content);
      setContent(response.content);
      setSuccessMessage("Wedding website content saved successfully.");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Wedding content could not be saved.");
    } finally { setIsSaving(false); }
  }

  async function addHeroImages(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setIsUploadingHeroImages(true);
    setHeroUploadError("");
    const uploadedImages: string[] = [];
    try {
      for (const file of files) {
        const response = await uploadAdministratorMedia(accessToken, file);
        uploadedImages.push(response.url);
      }
      setContent((current) => ({...current, heroImages:[...current.heroImages, ...uploadedImages]}));
    } catch (error) {
      if (uploadedImages.length) {
        setContent((current) => ({...current, heroImages:[...current.heroImages, ...uploadedImages]}));
      }
      setHeroUploadError(error instanceof ApiError ? error.message : "One or more hero images could not be uploaded.");
    } finally {
      setIsUploadingHeroImages(false);
      event.target.value = "";
    }
  }

  if (isLoading) return <p className="admin-table-message">Loading wedding content...</p>;

  return (
    <section className="admin-guests admin-content" aria-labelledby="content-management-title">
      <div className="admin-section-heading"><div><p className="admin-status-label">Phase 5</p><h2 id="content-management-title">Wedding content</h2><p>Manage the public website details without editing source files.</p></div></div>
      {errorMessage ? <p className="admin-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="admin-success" role="status">{successMessage}</p> : null}
      <form className="admin-content-form" onSubmit={save}>
        <ContentSection title="Wedding settings">
          <div className="admin-form-grid"><label>Wedding date and time<input type="datetime-local" value={content.weddingDateIso.slice(0, 16)} onChange={(event) => setContent({...content, weddingDateIso:`${event.target.value}:00+08:00`})} disabled={!canManage} required /></label><label>Displayed wedding date<input value={content.weddingDateDisplay} onChange={(event) => setContent({...content, weddingDateDisplay:event.target.value})} disabled={!canManage} required /></label><label>RSVP deadline<input type="date" value={content.rsvpDeadline} onChange={(event) => setContent({...content, rsvpDeadline:event.target.value})} disabled={!canManage} /></label><label>Displayed RSVP deadline<input value={content.rsvpDeadlineDisplay} onChange={(event) => setContent({...content, rsvpDeadlineDisplay:event.target.value})} disabled={!canManage} required /></label></div>
        </ContentSection>

        <ContentSection title="Website images">
          <p className="admin-content-help">JPEG, PNG, or WebP, up to 5 MB. Uploading replaces the selected image after you save the website content.</p>
          <div className="admin-media-grid">
            <ImageField label="Invitation background" value={content.coverImage} accessToken={accessToken} disabled={!canManage} onChange={(coverImage) => setContent({...content, coverImage})} />
            <ImageField label="Invitation portrait" value={content.portraitImage} accessToken={accessToken} disabled={!canManage} onChange={(portraitImage) => setContent({...content, portraitImage})} />
          </div>
          <fieldset><legend>Opening hero slideshow</legend><p className="admin-content-help">Add as many slideshow images as needed. You can select several files at once.</p><div className="admin-media-grid">{content.heroImages.map((image, index) => <ImageField key={`${image}-${index}`} label={`Hero image ${index + 1}`} value={image} accessToken={accessToken} disabled={!canManage} onChange={(value) => setContent({...content, heroImages:content.heroImages.map((entry, entryIndex) => entryIndex === index ? value : entry)})} onRemove={content.heroImages.length > 1 ? () => setContent({...content, heroImages:content.heroImages.filter((_, entryIndex) => entryIndex !== index)}) : undefined} />)}</div>{canManage ? <label className="admin-media-add">{isUploadingHeroImages ? "Uploading images..." : "Add images"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addHeroImages} disabled={isUploadingHeroImages} /></label> : null}{heroUploadError ? <p className="admin-media-error" role="alert">{heroUploadError}</p> : null}</fieldset>
          <fieldset><legend>Full-width divider backgrounds</legend><div className="admin-media-grid">{content.dividerImages.map((image, index) => <ImageField key={index} label={`Divider image ${index + 1}`} value={image} accessToken={accessToken} disabled={!canManage} onChange={(value) => setContent({...content, dividerImages:content.dividerImages.map((entry, entryIndex) => entryIndex === index ? value : entry)})} />)}</div></fieldset>
        </ContentSection>

        <ContentSection title="Venues">
          {(["ceremony", "reception"] as const).map((key) => <fieldset key={key}><legend>{key}</legend><ImageField label={`${key} background`} value={content[key].image} accessToken={accessToken} disabled={!canManage} onChange={(image) => setContent({...content, [key]:{...content[key], image}})} /><div className="admin-form-grid"><label>Name<input value={content[key].name} onChange={(event) => setContent({...content, [key]:{...content[key], name:event.target.value}})} disabled={!canManage} required /></label><label>Time<input value={content[key].time} onChange={(event) => setContent({...content, [key]:{...content[key], time:event.target.value}})} disabled={!canManage} required /></label><label>Address<input value={content[key].address} onChange={(event) => setContent({...content, [key]:{...content[key], address:event.target.value}})} disabled={!canManage} required /></label><label>Google Maps URL<input type="url" value={content[key].mapUrl} onChange={(event) => setContent({...content, [key]:{...content[key], mapUrl:event.target.value}})} disabled={!canManage} required /></label></div></fieldset>)}
        </ContentSection>

        <ContentSection title="Our Story">
          <label>Section heading<textarea rows={2} value={content.storyHeading} onChange={(event) => setContent({...content, storyHeading:event.target.value})} disabled={!canManage} /></label>
          {content.storyItems.map((item, index) => <fieldset key={index}><legend>Story {index + 1}</legend><ImageField label={`Story image ${index + 1}`} value={item.image} accessToken={accessToken} disabled={!canManage} onChange={(image) => setContent({...content, storyItems:content.storyItems.map((entry, entryIndex) => entryIndex === index ? {...entry, image} : entry)})} /><div className="admin-form-grid"><label>Eyebrow<input value={item.eyebrow} onChange={(event) => setContent({...content, storyItems:content.storyItems.map((entry, entryIndex) => entryIndex === index ? {...entry, eyebrow:event.target.value} : entry)})} disabled={!canManage} /></label><label>Title<input value={item.title} onChange={(event) => setContent({...content, storyItems:content.storyItems.map((entry, entryIndex) => entryIndex === index ? {...entry, title:event.target.value} : entry)})} disabled={!canManage} required /></label></div><label>Story text<textarea rows={3} value={item.body} onChange={(event) => setContent({...content, storyItems:content.storyItems.map((entry, entryIndex) => entryIndex === index ? {...entry, body:event.target.value} : entry)})} disabled={!canManage} required /></label></fieldset>)}
        </ContentSection>

        <ContentSection title="Entourage">
          <p className="admin-content-help">Add one person per line using <code>Role | Name</code>. The role may be left blank.</p>
          {content.entourageGroups.map((group, index) => <fieldset key={index}><legend>Group {index + 1}</legend><label>Group title<input value={group.title} onChange={(event) => setContent({...content, entourageGroups:content.entourageGroups.map((entry, entryIndex) => entryIndex === index ? {...entry, title:event.target.value} : entry)})} disabled={!canManage} required /></label><label>People<textarea rows={5} value={group.people.map((person) => `${person.role} | ${person.name}`).join("\n")} onChange={(event) => setContent({...content, entourageGroups:content.entourageGroups.map((entry, entryIndex) => entryIndex === index ? {...entry, people:event.target.value.split("\n").filter(Boolean).map((line) => { const [role, ...name] = line.split("|"); return {role:role.trim(), name:name.join("|").trim() || role.trim()}; })} : entry)})} disabled={!canManage} /></label>{canManage ? <button className="admin-content-remove" type="button" onClick={() => setContent({...content, entourageGroups:content.entourageGroups.filter((_, entryIndex) => entryIndex !== index)})}>Remove group</button> : null}</fieldset>)}
          {canManage ? <button className="admin-content-add" type="button" onClick={() => setContent({...content, entourageGroups:[...content.entourageGroups, {title:"New group", people:[]}]})}>Add entourage group</button> : null}
        </ContentSection>

        <ContentSection title="Gift details">
          {giftKeys.map((key) => { const method = content.gift[key]; return <fieldset key={key}><legend>{method.title}</legend><label className="admin-checkbox"><input type="checkbox" checked={method.enabled} onChange={(event) => setContent({...content, gift:{...content.gift, [key]:{...method, enabled:event.target.checked}}})} disabled={!canManage} />Show this gift method</label><ImageField label={`${method.title} QR code`} value={method.qr} accessToken={accessToken} disabled={!canManage} onChange={(qr) => setContent({...content, gift:{...content.gift, [key]:{...method, qr}}})} /><div className="admin-form-grid"><label>Title<input value={method.title} onChange={(event) => setContent({...content, gift:{...content.gift, [key]:{...method, title:event.target.value}}})} disabled={!canManage} required /></label><label>Account owner<input value={method.owner} onChange={(event) => setContent({...content, gift:{...content.gift, [key]:{...method, owner:event.target.value}}})} disabled={!canManage} /></label><label>Account number/details<input value={method.account} onChange={(event) => setContent({...content, gift:{...content.gift, [key]:{...method, account:event.target.value}}})} disabled={!canManage} /></label></div><label>Additional details<textarea rows={3} value={method.details.join("\n")} onChange={(event) => setContent({...content, gift:{...content.gift, [key]:{...method, details:event.target.value.split("\n").filter(Boolean)}}})} disabled={!canManage} /></label></fieldset>; })}
        </ContentSection>

        <ContentSection title="Feature switches">
          <div className="admin-feature-switches">{Object.entries(content.features).map(([key, enabled]) => <label className="admin-checkbox" key={key}><input type="checkbox" checked={enabled} onChange={(event) => setContent({...content, features:{...content.features, [key]:event.target.checked}})} disabled={!canManage} />Show {key} section</label>)}</div>
        </ContentSection>

        {canManage ? <div className="admin-content-save"><button type="submit" disabled={isSaving || isUploadingHeroImages}>{isSaving ? "Saving..." : "Save website content"}</button></div> : null}
      </form>
    </section>
  );
}

function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="admin-content-card"><h3>{title}</h3>{children}</section>;
}

function ImageField({ label, value, accessToken, disabled, onChange, onRemove }: { label: string; value: string; accessToken: string; disabled: boolean; onChange: (value: string) => void; onRemove?: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage("");
    setIsUploading(true);
    try {
      const response = await uploadAdministratorMedia(accessToken, file);
      onChange(response.url);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "The image could not be uploaded.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return <div className="admin-media-field"><span>{label}</span>{value ? <img src={apiAssetUrl(value)} alt={`${label} preview`} /> : <div className="admin-media-empty">No image uploaded</div>}<div className="admin-media-actions"><label className="admin-media-button">{isUploading ? "Uploading..." : "Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={disabled || isUploading} /></label>{onRemove && !disabled ? <button className="admin-media-remove" type="button" onClick={onRemove}>Remove</button> : null}</div>{errorMessage ? <small className="admin-media-error" role="alert">{errorMessage}</small> : null}</div>;
}
