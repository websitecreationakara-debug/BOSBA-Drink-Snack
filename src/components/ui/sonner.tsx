import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast",
          // Success confirmations — green background. `!` beats sonner's bundled
          // default toast CSS, which the low-specificity `group-[…]` variant
          // can't override on its own.
          success:
            "group-[.toaster]:bg-success! group-[.toaster]:text-white! group-[.toaster]:border-success! [&_[data-icon]]:text-white!",
          // Errors — red background.
          error:
            "group-[.toaster]:bg-destructive! group-[.toaster]:text-white! group-[.toaster]:border-destructive! [&_[data-icon]]:text-white!",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
