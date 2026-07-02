import resources from "../prompts/resources.json";

interface ResourceEntry {
  id: string;
  title: string;
  description: string;
  url: string;
}

const referralResources = resources as ResourceEntry[];

export function VerifyFooter() {
  return (
    <div className="verify-footer">
      <p className="verify-footer-title">Verify against:</p>
      <ul className="verify-footer-list">
        {referralResources.map((resource) => (
          <li key={resource.id}>
            {resource.url ? (
              <a href={resource.url} target="_blank" rel="noreferrer">
                {resource.title}
              </a>
            ) : (
              <span>{resource.title}</span>
            )}{" "}
            — {resource.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
