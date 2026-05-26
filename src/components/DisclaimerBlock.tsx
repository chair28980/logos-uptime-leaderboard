import ExternalLink from "./ExternalLink";

export default function DisclaimerBlock() {
  return (
    <section className="text-muted text-xs leading-relaxed space-y-3">
      <p>
        This is an UNOFFICIAL community project. It is not affiliated with or
        endorsed by Logos, the Institute of Free Technology, or any related
        entity.
      </p>
      <p>
        Data is derived from publicly available blockchain network data.
      </p>
      <div className="flex flex-wrap gap-4 pt-1">
        <ExternalLink href="https://logos.co">logos.co</ExternalLink>
        <ExternalLink href="https://blog.logos.co">blog.logos.co</ExternalLink>
        <ExternalLink href="https://build.logos.co">build.logos.co</ExternalLink>
      </div>
      <p className="pt-1">
        &copy; {new Date().getFullYear()} Built for the community.
      </p>
    </section>
  );
}