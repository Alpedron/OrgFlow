import { Link } from "react-router-dom";

export default function PublicFooter() {
  return (
    <footer className="landing-footer">
      <span>
        © {new Date().getFullYear()} OrgFlow · Independently developed by{" "}
        <a href="https://adriannapedron.com" target="_blank" rel="noopener noreferrer">
          Adrianna Pedron
        </a>
      </span>
      <span>Built for the OCC student community</span>
    </footer>
  );
}
