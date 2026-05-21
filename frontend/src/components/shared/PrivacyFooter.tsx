import { Link } from "react-router-dom";

export function PrivacyFooter({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-center text-xs text-gray-500"}>
      <Link to="/privacy" className="hover:text-indigo-600">
        Politique de confidentialité
      </Link>
    </p>
  );
}
