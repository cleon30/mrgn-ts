import React from "react";

import { ActionType } from "@mrgnlabs/marginfi-v2-ui-state";
import { getBlockedActions, cn } from "@mrgnlabs/mrgn-utils";

import { ActionSettings } from "../action-settings";
import { useActionBoxStore } from "../../store";

interface ActionBoxWrapperProps {
  actionMode: ActionType;
  isDialog?: boolean;
  showSettings?: boolean;
  children: React.ReactNode;
}

export const ActionBoxWrapper = ({ children, isDialog, actionMode, showSettings = true }: ActionBoxWrapperProps) => {
  const [slippage, isSettingsDialogOpen, setIsSettingsDialogOpen, setSlippageBps] = useActionBoxStore((state) => [
    state.slippageBps,
    state.isSettingsDialogOpen,
    state.setIsSettingsDialogOpen,
    state.setSlippageBps,
  ]);

  const isActionDisabled = React.useMemo(() => {
    const blockedActions = getBlockedActions();
    if (blockedActions?.find((value) => value === actionMode)) return true;
    return false;
  }, [actionMode]);

  const isSlippageEnabled = React.useMemo(
    () =>
      actionMode === ActionType.Repay ||
      actionMode === ActionType.RepayCollat ||
      actionMode === ActionType.MintLST ||
      actionMode === ActionType.UnstakeLST ||
      actionMode === ActionType.Loop,
    [actionMode]
  );

  React.useEffect(() => {
    setIsSettingsDialogOpen(false);
  }, [setIsSettingsDialogOpen]);

  if (isActionDisabled) {
    return (
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "bg-mfi-action-box-background p-4 md:p-6 text-bg-mfi-action-box-foreground w-full max-w-[480px] rounded-lg relative",
            isDialog && "py-5 border border-border"
          )}
        >
          Action is temporary disabled. <br /> Visit our socials for more information.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "bg-mfi-action-box-background p-2 md:p-3 text-bg-mfi-action-box-foreground w-full max-w-[480px] rounded-lg relative",
            isDialog && "py-5"
          )}
        >
          {isSettingsDialogOpen && showSettings && (
            <ActionSettings
              slippage={isSlippageEnabled ? slippage : undefined}
              changeSlippage={setSlippageBps}
              toggleSettings={(value) => setIsSettingsDialogOpen(value)}
            />
          )}

          <div className={cn(isSettingsDialogOpen && showSettings && "hidden")}>{children}</div>
        </div>
      </div>
    </>
  );
};
