interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
}

export default function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cream underline underline-offset-2 decoration-green/40 hover:decoration-cream transition-colors duration-150"
    >
      {children}
    </a>
  );
}