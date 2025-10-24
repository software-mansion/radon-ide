import { OverlayScrollbarsComponent } from "overlayscrollbars-react";

interface TabScrollableProps {
  children: React.ReactNode;
  height: number | undefined;
}

const TabScrollable = ({ children, height }: TabScrollableProps) => {
  return (
    <OverlayScrollbarsComponent
      options={{
        scrollbars: {
          autoHide: "leave",
          autoHideDelay: 100,
          visibility: "auto",
        },
      }}
      className="network-log-details-tab-scrollable"
      style={{
        height: height,
      }}>
      <div className="network-log-details-tab">{children}</div>
    </OverlayScrollbarsComponent>
  );
};

export default TabScrollable;
