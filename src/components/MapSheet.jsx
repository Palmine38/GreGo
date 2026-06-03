import React from "react";
import { Sheet } from "react-modal-sheet";

export function MapSheet({ isOpen, onClose, title, children }) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[0, 0.68, 1]}
      initialSnap={1}
      dragVelocityThreshold={200}
      dragCloseThreshold={0.3}
    >
      <Sheet.Container style={{ borderRadius: "24px 24px 0 0" }}>
        <Sheet.Header />
        <Sheet.Content>
          <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
            <span className="font-bold text-lg">{title}</span>
          </div>
          <div className="overflow-y-auto px-4 pb-10">{children}</div>
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop onTap={onClose} />
    </Sheet>
  );
}
