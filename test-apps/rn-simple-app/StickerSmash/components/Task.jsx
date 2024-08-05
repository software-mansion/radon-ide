export default function Task({ task: { id, title, state }, onArchiveTask, onPinTask }) {
    return (
      <div className="list-item">
        <label htmlFor={`title-${id}`} aria-label={title}>
          <input type="text" value={title} readOnly={true} name="title" id={`title-${id}`} />
        </label>
      </div>
    );
  }