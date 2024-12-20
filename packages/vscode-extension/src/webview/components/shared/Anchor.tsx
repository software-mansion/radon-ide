import { useUtils } from "../../providers/UtilsProvider";

interface AnchorProps {
  url: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function Anchor({ url, children, onClick }: AnchorProps) {
  const utils = useUtils();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    utils.openExternalUrl(url);
  };

  return (
    <a href="#" onClick={onClick ?? handleClick}>
      {children}
    </a>
  );
}

export default Anchor;
