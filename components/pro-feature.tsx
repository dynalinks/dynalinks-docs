import { Callout } from "fumadocs-ui/components/callout";

export function ProFeature({ message }: { message?: string }) {
  return (
    <Callout title="Pro feature">
      {message ?? "This functionality is only available on the Pro plan."}
    </Callout>
  );
}
