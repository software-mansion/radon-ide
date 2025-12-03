// Note(Filip Kamiński): This should never happen as we hid disabled options in the ui but if user somehow will find a way
// to trigger restricted functionality wie prepare this screen to inform them we they can not use the feature.

import "./AdminBlockView.css";
import RadonBackgroundImage from "../components/RadonBackgroundImage";
import { useModal } from "../providers/ModalProvider";

type AdminBlockViewProps = {
  featureName?: string;
};

function AdminBlockView({ featureName }: AdminBlockViewProps) {
  const { closeModal } = useModal();

  return (
    <div className="admin-block-view">
      <RadonBackgroundImage className="admin-block-background-image" />
      <div className="admin-block-container">
        <div className="admin-block-icon">
          <span className="codicon codicon-lock" />
        </div>

        <h1 className="admin-block-title">Feature Disabled by Administrator</h1>

        <div className="admin-block-message">
          <p>
            {featureName ? (
              <>
                The <strong>{featureName}</strong> feature has been disabled by your organization's
                administrator.
              </>
            ) : (
              <>This feature has been disabled by your organization's administrator.</>
            )}
          </p>
          <p>Please contact a person that manages your license to request access.</p>
        </div>

        <button className="admin-block-button" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
}

export default AdminBlockView;
