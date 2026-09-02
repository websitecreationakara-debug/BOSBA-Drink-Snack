import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  /** Dialog heading. */
  title?: React.ReactNode;
  /** Supporting copy under the heading. */
  description?: React.ReactNode;
  /** Label for the confirm button. */
  confirmText?: string;
  /** Label for the cancel button. */
  cancelText?: string;
  /** Style the confirm button as a destructive (red) action. Defaults to true. */
  destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
};

const ConfirmContext = React.createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

/**
 * Promise-based confirmation dialog. Drop <ConfirmProvider> near the app root,
 * then call `const confirm = useConfirm()` and `await confirm({ ... })` — it
 * resolves `true` when the user confirms, `false` on cancel / dismiss.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({ open: false, resolve: null });

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const destructive = state.destructive ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              {destructive && (
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </span>
              )}
              <div className="space-y-2 pt-0.5">
                <AlertDialogTitle>{state.title ?? "Are you sure?"}</AlertDialogTitle>
                {state.description && (
                  <AlertDialogDescription>{state.description}</AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel onClick={() => settle(false)}>
              {state.cancelText ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(destructive && buttonVariants({ variant: "destructive" }))}
            >
              {state.confirmText ?? "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
