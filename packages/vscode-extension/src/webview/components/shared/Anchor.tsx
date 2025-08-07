import { useProject } from "../../providers/ProjectProvider";

interface AnchorProps {
  url: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function Anchor({ url, children, onClick }: AnchorProps) {
  const { project } = useProject();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    project.openExternalUrl(url);
  };

  return (
    <a href="#" onClick={onClick ?? handleClick}>
      {children}
    </a>
  );
}

export default Anchor;
