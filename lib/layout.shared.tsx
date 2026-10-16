import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* biome-ignore lint/performance/noImgElement: static export, no image optimisation */}
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.webp`}
            alt=""
            height={24}
            width={24}
          />
          <span className="font-semibold">{appName}</span>
        </>
      ),
    },
    links: [
      { text: "Home", url: "https://dynalinks.app" },
      { text: "API", url: "/reference" },
      { text: "Pricing", url: "https://dynalinks.app/pricing" },
      { text: "FAQ", url: "https://dynalinks.app/faq" },
      { text: "Console", url: "https://dynalinks.app/users/sign_in" },
    ],
    githubUrl: "https://github.com/dynalinks",
  };
}
