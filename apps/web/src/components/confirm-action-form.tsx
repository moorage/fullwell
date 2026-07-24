import { TriangleAlert } from "lucide-react";
import { useId, useRef, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Button } from "./ui.js";

type ConfirmationLiteral = "DELETE" | "LEAVE" | "REVOKE";

type ConfirmActionFormProps = {
  action: string;
  buttonLabel: string;
  confirmation: ConfirmationLiteral;
  csrf: string;
  description: string;
  fields?: ReactNode;
  icon: ReactNode;
  title: string;
};

export function ConfirmActionForm({
  action,
  buttonLabel,
  confirmation,
  csrf,
  description,
  fields,
  icon,
  title,
}: ConfirmActionFormProps) {
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmedSubmissionRef = useRef(false);
  const titleId = useId();

  function getDialog() {
    const dialog = dialogRef.current;
    if (dialog === null) throw new Error("Confirmation dialog is unavailable");
    return dialog;
  }

  function closeDialog() {
    getDialog().close();
  }

  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmissionRef.current) {
      confirmedSubmissionRef.current = false;
      return;
    }

    event.preventDefault();
    const submitButton = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton === null) throw new Error("Confirmation submit button is unavailable");
    submitButtonRef.current = submitButton;
    getDialog().showModal();
  }

  function confirmSubmission() {
    const form = formRef.current;
    const submitButton = submitButtonRef.current;
    if (form === null || submitButton === null) throw new Error("Confirmation form is unavailable");

    let confirmationField = form.querySelector<HTMLInputElement>('input[data-confirmation-field="true"]');
    if (confirmationField === null) {
      confirmationField = document.createElement("input");
      confirmationField.type = "hidden";
      confirmationField.name = "confirmation";
      confirmationField.dataset.confirmationField = "true";
      form.append(confirmationField);
    }
    confirmationField.value = confirmation;
    confirmedSubmissionRef.current = true;
    closeDialog();
    form.requestSubmit(submitButton);
  }

  return (
    <>
      <form ref={formRef} className="confirmation-form" action={action} method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="csrf" value={csrf} />
        {fields}
        <noscript>
          <label>
            <span>Type {confirmation} to continue</span>
            <input name="confirmation" autoComplete="off" required />
          </label>
        </noscript>
        <Button type="submit" variant="danger">{icon} {buttonLabel}</Button>
      </form>
      <dialog
        ref={dialogRef}
        className="confirmation-dialog"
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={handleDialogClick}
        onClose={() => submitButtonRef.current?.focus()}
      >
        <div className="confirmation-dialog__body">
          <span className="confirmation-dialog__icon"><TriangleAlert aria-hidden="true" /></span>
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
        </div>
        <div className="confirmation-dialog__actions">
          <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
          <Button type="button" variant="danger" onClick={confirmSubmission}>{buttonLabel}</Button>
        </div>
      </dialog>
    </>
  );
}
