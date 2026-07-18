interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  return (
    <>
      <div className="confirm-backdrop" onClick={onCancel} />
      <div className="confirm-popup">
        <p className="confirm-msg">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-g" onClick={onCancel}>Cancel</button>
          <button className="btn btn-d" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </>
  );
}
