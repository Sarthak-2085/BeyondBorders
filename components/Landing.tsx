"use client";
import Link from "next/link";
import { useRef, useEffect } from "react";
import {
  Compass,
  Globe2,
  Mouse,
  MapPin,
  BookOpen,
  Route,
  Telescope,
  ScanLine,
  MoveDown,
  ArrowUpRight,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeStage from "./GlobeStage";
import LandingCorridor from "./LandingCorridor";
export type LandingData = {
  period: string;
  total: number;
  origins: number;
  destinations: number;
  source: string;
  leader: string;
  leading: number;
};
const compact = (v: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
export default function Landing({ data }: { data: LandingData | null }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const scope = gsap.context(() => {
      gsap.fromTo(
        ".hero-copy > *",
        { y: 9 },
        { y: 0, stagger: 0.075, duration: 0.65, clearProps: "transform" },
      );
      gsap.to(".plot-lines", {
        rotation: 12,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
      gsap.to(".globe-viewport", {
        y: 20,
        scale: 0.965,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, root);
    return () => scope.revert();
  }, []);
  return (
    <main id="main" ref={root}>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow hero-kicker">
              <i />
              Global education intelligence <b>/</b> Est. 2026
            </div>
            <h1>
              THE WORLD
              <br />
              IS OPEN.
              <br />
              <em>
                WHERE WILL
                <br />
                YOU GO?
              </em>
            </h1>
            <p>
              Understanding the movement of students, ideas and opportunities
              across the world.
            </p>
            <div className="hero-actions">
              <Link href="/explore/" className="button dark">
                <Compass size={17} />
                Explore the atlas
              </Link>
              <a href="#motion" className="text-link">
                Discover global mobility
              </a>
            </div>
          </div>
          <div className="hero-figure">
            <div className="network-label">
              <span className="network-icon">
                <ScanLine size={23} />
              </span>
              <span>
                Global mobility
                <br />
                data network
              </span>
            </div>
            <GlobeStage />
            <div className="reference-label">
              <i />
              Reference period <b>{data?.period || "See sources"}</b>
            </div>
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#motion">
            <MoveDown size={13} />
            Scroll to explore
          </a>
          <span className="scale-rule" aria-hidden="true" />
          <span className="bottom-coords">
            23°26′ N &nbsp; / &nbsp; 66°34′ E
          </span>
        </div>
      </section>
      <section id="motion" className="motion-strip">
        <div className="motion-heading">
          <div className="eyebrow">
            <i />
            Global mobility
          </div>
          <h2>
            The world
            <br />
            <em>in motion.</em>
          </h2>
        </div>
        {data ? (
          <>
            <div className="metric">
              <strong>{compact(data.total)}</strong>
              <span>Internationally mobile students</span>
              <small>UNESCO UIS · {data.period}</small>
            </div>
            <div className="metric">
              <strong>{data.destinations}</strong>
              <span>Destinations with inflow data</span>
              <small>Atlas coverage · {data.period}</small>
            </div>
            <div className="metric">
              <strong>{data.origins}</strong>
              <span>Origins with outflow data</span>
              <small>Atlas coverage · {data.period}</small>
            </div>
          </>
        ) : (
          <div className="metric">
            <Link href="/reports/">Browse mobility sources</Link>
          </div>
        )}
      </section>
      <section className="section feature">
        <div>
          <span className="eyebrow">
            <i />
            Education without borders
          </span>
          <h2>
            Follow the
            <br />
            <em>movement.</em>
          </h2>
          <p>
            Select two countries to trace a student corridor through time. Each
            observation carries its source and reference period.
          </p>
          {data && (
            <p className="editorial-fact">
              <strong>{data.leader}</strong> recorded{" "}
              {data.leading.toLocaleString("en-US")} inbound students in{" "}
              {data.period}, the highest count among destinations reporting that
              year.{" "}
              <Link href="/reports/?dataset=uis-mobility">UNESCO UIS</Link>
            </p>
          )}
          <Link className="button dark" href="/explore/">
            <Route size={17} />
            Open the mobility map
          </Link>
        </div>
        <LandingCorridor />
      </section>
      <section className="destinations section">
        <div className="section-row">
          <div>
            <span className="eyebrow">
              <i />
              Country intelligence
            </span>
            <h2>
              The <em>destinations.</em>
            </h2>
          </div>
          <Link href="/countries/" className="text-link">
            Country directory
          </Link>
        </div>
        <div className="photo-row">
          {[
            ["United Kingdom", "London", "london", "GBR"],
            ["Germany", "Berlin", "berlin", "DEU"],
            ["United States", "New York", "new-york", "USA"],
          ].map(([n, city, img, iso]) => (
            <Link
              key={iso}
              href={"/countries/?country=" + iso}
              className="photo-story"
            >
              <div>
                <img
                  loading="lazy"
                  src={"/photos/" + img + ".webp"}
                  alt={city + " cityscape"}
                />
              </div>
              <small>
                <MapPin size={13} />
                {city}
              </small>
              <h3>{n}</h3>
            </Link>
          ))}
        </div>
      </section>
      <section className="section more-grid">
        {[
          [
            BookOpen,
            "What the world studies",
            "Browse disciplines and the destinations that report them.",
            "Explore courses",
            "/courses/",
          ],
          [
            Compass,
            "The next destination",
            "Build your shortlist around a course, timeline and budget.",
            "Study planner",
            "/planner/",
          ],
          [
            Telescope,
            "Beyond the numbers",
            "Ask the analyst about a corridor, a country or a changing trend.",
            "Open intelligence",
            "/intelligence/",
          ],
        ].map(([I, title, p, l, h]) => {
          const Icon = I as typeof Globe2;
          return (
            <article key={String(h)}>
              <Icon size={25} />
              <h3>{String(title)}</h3>
              <p>{String(p)}</p>
              <Link className="text-link" href={String(h)}>
                {String(l)}
              </Link>
            </article>
          );
        })}
      </section>
      <section className="final-cta">
        <h2>
          Your next chapter
          <br />
          <em>starts beyond borders.</em>
        </h2>
        <Link className="button light" href="/planner/">
          <Compass size={17} />
          Start planning
        </Link>
      </section>
    </main>
  );
}
