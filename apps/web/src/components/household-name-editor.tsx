import { Pencil } from "lucide-react";
import { useId, useRef, type MouseEvent } from "react";
import type { HouseholdSummary } from "../types.js";
import { Button, Field, HiddenFormFields, TextInput, VisuallyHidden } from "./ui.js";

export function HouseholdNameEditor({ household }: { household: HouseholdSummary }) {
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    const dialog = dialogRef.current;
    if (dialog === null) throw new Error("Household name dialog is unavailable");
    dialog.close();
  }

  function openDialog() {
    const dialog = dialogRef.current;
    const input = inputRef.current;
    if (dialog === null || input === null) throw new Error("Household name editor is unavailable");
    dialog.showModal();
    input.focus();
    input.select();
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  const action = `/households/${encodeURIComponent(household.id)}/name`;
  return (
    <>
      <button
        ref={triggerRef}
        className="household-name-edit"
        type="button"
        aria-haspopup="dialog"
        aria-label="Edit household name"
        title="Edit household name"
        onClick={openDialog}
      >
        <Pencil aria-hidden="true" size={18} />
        <VisuallyHidden>Edit household name</VisuallyHidden>
      </button>
      <dialog
        ref={dialogRef}
        className="household-name-dialog"
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={handleDialogClick}
        onClose={() => triggerRef.current?.focus()}
      >
        <form action={action} method="post">
          <HiddenFormFields idempotencyKey={`rename-${household.id}`} />
          <input type="hidden" name="expectedHead" value={household.repositoryHead} />
          <header>
            <h2 id={titleId}>Change household name</h2>
            <p id={descriptionId}>Use a short name everyone in the household will recognize.</p>
          </header>
          <Field label="Household name">
            <TextInput
              ref={inputRef}
              autoFocus
              autoComplete="organization"
              defaultValue={household.name}
              maxLength={120}
              name="name"
              required
            />
          </Field>
          <div className="household-name-dialog__actions">
            <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
            <Button type="submit">Save name</Button>
          </div>
        </form>
      </dialog>
      <noscript>
        <form action={action} method="post" className="household-name-fallback">
          <HiddenFormFields idempotencyKey={`rename-${household.id}-nojs`} />
          <input type="hidden" name="expectedHead" value={household.repositoryHead} />
          <Field label="Change household name">
            <TextInput defaultValue={household.name} maxLength={120} name="name" required />
          </Field>
          <Button type="submit">Save name</Button>
        </form>
      </noscript>
    </>
  );
}
