/**
 * Flat screen-printed poster scenes (wavz style): solid shapes only, no gradients, no blur.
 * Every scene is drawn in a 400x300 box and leaves the top-left corner as flat sky, so the
 * plate caption can sit there on the scene's `sky` colour.
 */

type SceneProps = { className?: string; slice?: boolean };

/** A row of humps from x=0 to x=w at height y, closed down to the bottom of the box. */
function wave(y: number, amp: number, len: number, w = 400, h = 300) {
  let d = `M0 ${y}`;
  for (let x = 0; x < w + len; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
  return `${d} V${h} H0 Z`;
}

function Stars({ at, fill = "#f2e5c3" }: { at: [number, number, number?][]; fill?: string }) {
  return (
    <g fill={fill}>
      {at.map(([x, y, r = 1.3]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

/** A four-point sparkle star. */
function Sparkle({ x, y, s = 4, fill = "#f2e5c3" }: { x: number; y: number; s?: number; fill?: string }) {
  const k = s / 4;
  return <path d={`M${x} ${y - s}L${x + k} ${y - k}L${x + s} ${y}L${x + k} ${y + k}L${x} ${y + s}L${x - k} ${y + k}L${x - s} ${y}L${x - k} ${y - k}Z`} fill={fill} />;
}

/** Horizontal light streaks on water (moon or lantern reflections). */
function Streaks({ x, y, widths, fill, gap = 7 }: { x: number; y: number; widths: number[]; fill: string; gap?: number }) {
  return (
    <g fill={fill}>
      {widths.map((w, i) => (
        <rect key={i} x={x - w / 2 + (i % 2 ? 3 : -2)} y={y + i * gap} width={w} height={3} />
      ))}
    </g>
  );
}

function Svg({ children, className, slice }: SceneProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio={slice ? "xMidYMid slice" : "xMidYMid meet"}
      aria-hidden
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ---------- 01 Moonpath: a moon over the sea (teal and night blue, sand orange) ---------- */
export function MoonpathScene(props: SceneProps) {
  return (
    <Svg {...props}>
      <rect width="400" height="300" fill="#13315c" />
      <circle cx="285" cy="92" r="96" fill="#1a4672" />
      <circle cx="285" cy="92" r="62" fill="#2f7f86" />
      <circle cx="285" cy="92" r="27" fill="#f2c14e" />
      <rect x="318" y="140" width="96" height="9" fill="#1a4672" />
      <rect x="196" y="122" width="60" height="7" fill="#1a4672" />
      <Stars at={[[220, 24], [372, 30], [386, 118], [208, 70, 1], [244, 150, 1], [360, 70, 1]]} />
      <Sparkle x={382} y={70} s={4} />
      {/* headland and lighthouse */}
      <path d="M0 176V146l34-14 30 6 40 18 46 20Z" fill="#0f2747" />
      <path d="M66 138l94-14v28Z" fill="#f2c14e" />
      <rect x="58" y="118" width="9" height="22" fill="#f2e5c3" />
      <path d="M56 119h13l-6.5-7Z" fill="#f07a2e" />
      {/* sea */}
      <rect y="172" width="400" height="128" fill="#163f6b" />
      <path d={wave(190, 5, 64)} fill="#1d5a78" />
      <path d={wave(208, 5, 52)} fill="#163f6b" />
      <path d={wave(226, 6, 70)} fill="#2a6f88" />
      <path d={wave(244, 5, 58)} fill="#1d5a78" />
      <g fill="#f2e5c3">
        <rect x="24" y="200" width="26" height="2" />
        <rect x="120" y="216" width="34" height="2" />
        <rect x="336" y="198" width="30" height="2" />
        <rect x="350" y="232" width="24" height="2" />
        <rect x="190" y="238" width="22" height="2" />
      </g>
      <Streaks x={285} y={180} widths={[14, 22, 30, 24, 36, 28, 40]} fill="#f2c14e" />
      {/* boat */}
      <path d="M244 172h22l-3 5h-16Z" fill="#0f2747" />
      <path d="M255 147v24h-12Z" fill="#f2e5c3" />
      <path d="M257 152v19h9Z" fill="#f2e5c3" />
      {/* beach */}
      <path d="M0 300V252q120-24 240-6t160 10V300Z" fill="#f07a2e" />
      <path d="M0 252q120-24 240-6t160 10v4q-40-4-160-10T0 256Z" fill="#f2e5c3" />
      <path d="M0 300V276q140-14 400 6V300Z" fill="#d9662a" />
      <g fill="#0f2340">
        <path d="M14 254l3-30 3 30Z" />
        <path d="M22 254l6-26 0 26Z" />
        <path d="M30 252l-4-22 7 22Z" />
        <path d="M38 251l5-18 1 18Z" />
        <path d="M46 250l-2-24 6 24Z" />
        <path d="M58 248l4-16 1 16Z" />
      </g>
      {/* palm */}
      <path d="M352 300C350 250 340 210 318 172" stroke="#0f2340" strokeWidth="9" fill="none" />
      <g fill="#0f2340">
        <path d="M318 170q30-26 70-16q-36-2-70 20Z" />
        <path d="M318 170q-34-24-74-12q38-2 72 16Z" />
        <path d="M318 170q8-34 46-46q-30 18-42 48Z" />
        <path d="M318 170q-20-30-58-34q34 10 54 38Z" />
        <path d="M318 170q36 4 56 34q-26-22-58-30Z" />
        <path d="M318 170q-34 10-46 40q18-28 48-36Z" />
      </g>
    </Svg>
  );
}

/* ---------- 02 Hidden falls: a jungle waterfall (greens, moon, orange flowers) ---------- */
export function HiddenFallsScene(props: SceneProps) {
  return (
    <Svg {...props}>
      <rect width="400" height="300" fill="#123d33" />
      <circle cx="262" cy="92" r="74" fill="#1c5443" />
      <circle cx="262" cy="86" r="23" fill="#f2c14e" />
      {/* canopy, top right */}
      <g fill="#0b2a22">
        <circle cx="372" cy="10" r="48" />
        <circle cx="330" cy="-6" r="34" />
        <circle cx="400" cy="70" r="30" />
      </g>
      <path d="M352 30v92M372 40v66M338 22v54" stroke="#2f6b3d" strokeWidth="2" />
      <g fill="#3d7a45">
        <path d="M352 122q-6 6 0 12q6-6 0-12Z" />
        <path d="M372 106q-6 6 0 12q6-6 0-12Z" />
        <path d="M338 76q-6 6 0 12q6-6 0-12Z" />
      </g>
      {/* cliffs and the falls */}
      <path d="M150 300V150l22-30 46-6v186Z" fill="#1b4d3d" />
      <path d="M262 300V114l40 8 24 36v142Z" fill="#1b4d3d" />
      <path d="M150 300V200l30-20v120Z" fill="#163f33" />
      <rect x="218" y="114" width="44" height="130" fill="#e6efe2" />
      <g fill="#b9d6cc">
        <rect x="226" y="122" width="3" height="110" />
        <rect x="238" y="114" width="3" height="96" />
        <rect x="250" y="130" width="3" height="104" />
      </g>
      {/* pool */}
      <rect y="236" width="400" height="64" fill="#1f6168" />
      <path d="M206 240q34-12 68 0q-34 8-68 0Z" fill="#f2e5c3" />
      <Streaks x={240} y={252} widths={[30, 22, 34, 18]} fill="#f2c14e" />
      <g fill="#2f8a86">
        <rect x="60" y="256" width="40" height="3" />
        <rect x="320" y="266" width="44" height="3" />
      </g>
      {/* foreground leaves */}
      <g fill="#3d7a45">
        <path d="M-10 300q10-90 80-130q-30 60-40 130Z" />
        <path d="M30 300q30-70 110-90q-50 40-70 90Z" />
        <path d="M410 300q-20-90-90-120q34 56 40 120Z" />
      </g>
      <g fill="#4f9a52">
        <path d="M0 300q40-50 120-56q-60 26-80 56Z" />
        <path d="M400 300q-40-60-110-60q56 26 70 60Z" />
        <path d="M60 300q-20-60 10-120q0 60 20 120Z" />
      </g>
      <g fill="#2f6b3d">
        <path d="M120 300q-10-40 30-70q-8 40 0 70Z" />
        <path d="M300 300q10-50-24-80q4 46 4 80Z" />
      </g>
      {/* flowers */}
      {[
        [96, 214],
        [344, 206],
        [30, 252],
        [374, 248],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <g fill="#f07a2e">
            <circle cx={x} cy={y - 5} r="4" />
            <circle cx={x + 5} cy={y} r="4" />
            <circle cx={x} cy={y + 5} r="4" />
            <circle cx={x - 5} cy={y} r="4" />
          </g>
          <circle cx={x} cy={y} r="2.5" fill="#f2c14e" />
        </g>
      ))}
      <Stars at={[[200, 30], [312, 150, 1], [186, 96, 1]]} />
    </Svg>
  );
}

/* ---------- 03 Lantern harbour: a night harbour (navy, lantern orange and yellow) ---------- */
export function HarbourScene(props: SceneProps) {
  const buildings: [number, number, number, string][] = [
    [0, 136, 30, "#1f3d6e"],
    [30, 124, 26, "#264a80"],
    [56, 146, 34, "#1f3d6e"],
    [90, 118, 22, "#264a80"],
    [112, 140, 30, "#1f3d6e"],
    [142, 128, 24, "#264a80"],
    [166, 112, 18, "#1f3d6e"],
    [184, 134, 30, "#264a80"],
    [214, 144, 28, "#1f3d6e"],
    [242, 122, 26, "#264a80"],
    [268, 138, 32, "#1f3d6e"],
    [300, 116, 24, "#264a80"],
    [324, 132, 30, "#1f3d6e"],
    [354, 146, 22, "#264a80"],
    [376, 126, 24, "#1f3d6e"],
  ];
  const lit = new Set([1, 3, 4, 6, 7, 9, 10, 12, 13]);
  return (
    <Svg {...props}>
      <rect width="400" height="300" fill="#0e1c3a" />
      <circle cx="312" cy="58" r="70" fill="#162a52" />
      <circle cx="312" cy="58" r="20" fill="#f2c14e" />
      <circle cx="321" cy="51" r="17" fill="#162a52" />
      <Stars at={[[216, 22], [384, 112], [250, 88, 1], [370, 20, 1], [226, 60, 1]]} />
      <Sparkle x={262} y={36} s={4} />
      {/* lantern string */}
      <path d="M204 12q90 44 200 10" stroke="#0a1530" strokeWidth="2" fill="none" />
      {[
        [222, 22, "#f07a2e"],
        [250, 30, "#f2c14e"],
        [282, 35, "#f07a2e"],
        [346, 34, "#f2c14e"],
        [378, 28, "#f07a2e"],
      ].map(([x, y, c]) => (
        <g key={`${x}`}>
          <rect x={(x as number) - 1} y={(y as number) - 2} width="2" height="6" fill="#0a1530" />
          <rect x={(x as number) - 5} y={(y as number) + 4} width="10" height="12" fill={c as string} />
        </g>
      ))}
      {/* hills and town */}
      <path d="M0 150q60-40 130-20t130-10t140 20V200H0Z" fill="#162a52" />
      {buildings.map(([x, y, w, c], i) => (
        <g key={x}>
          <rect x={x} y={y} width={w} height={196 - y} fill={c} />
          {lit.has(i)
            ? [0, 1, 2].map((r) =>
                [0, 1].map((k) => (
                  <rect key={`${r}-${k}`} x={x + 5 + k * (w / 2 - 2)} y={y + 8 + r * 16} width="6" height="8" fill={(r + k + i) % 4 ? "#f2c14e" : "#f07a2e"} />
                )),
              )
            : null}
        </g>
      ))}
      <rect x="170" y="96" width="10" height="20" fill="#1f3d6e" />
      <circle cx="175" cy="104" r="4" fill="#f2e5c3" />
      {/* water */}
      <rect y="196" width="400" height="104" fill="#13295a" />
      <path d={wave(220, 4, 60)} fill="#1a3768" />
      <path d={wave(248, 4, 48)} fill="#13295a" />
      <path d={wave(270, 4, 66)} fill="#1a3768" />
      {[38, 100, 160, 196, 260, 314, 366].map((x, i) => (
        <Streaks key={x} x={x} y={204 + (i % 2) * 4} widths={[10, 6, 12, 7]} fill={i % 3 ? "#f2c14e" : "#f07a2e"} gap={9} />
      ))}
      {/* boat */}
      <path d="M212 232h46l-6 9h-34Z" fill="#f07a2e" />
      <path d="M236 192v38h-22Z" fill="#f2e5c3" />
      <path d="M239 200v30h14Z" fill="#f2e5c3" />
      <rect x="236" y="188" width="3" height="44" fill="#0a1530" />
      {/* pier */}
      <rect x="290" y="252" width="110" height="7" fill="#0a1530" />
      <g fill="#0a1530">
        <rect x="300" y="252" width="5" height="48" />
        <rect x="340" y="252" width="5" height="48" />
        <rect x="380" y="252" width="5" height="48" />
      </g>
      <rect x="326" y="236" width="10" height="16" fill="#f2c14e" />
      <rect x="330" y="232" width="2" height="4" fill="#0a1530" />
    </Svg>
  );
}

/* ---------- 04 Aurora: northern lights over a lake (plum night, greens, a lit cabin) ---------- */
export function AuroraScene(props: SceneProps) {
  return (
    <Svg {...props}>
      <rect width="400" height="300" fill="#23173a" />
      <Stars at={[[220, 18], [380, 16], [300, 40, 1], [250, 64, 1], [364, 84, 1], [210, 104, 1]]} />
      <Sparkle x={346} y={30} s={4} />
      {/* aurora ribbons: flat bands, back to front */}
      <path d="M0 182C120 165 240 150 300 120S380 50 400 20V50C380 90 340 135 300 145C220 170 120 185 0 204Z" fill="#2f9a9a" />
      <path d="M0 168C120 150 230 135 290 108S370 40 400 6V26C380 60 340 112 296 126C220 155 120 168 0 184Z" fill="#4fb286" />
      <path d="M120 188C200 174 260 162 310 142S380 92 400 72V84C380 104 340 150 312 158C260 174 200 184 120 196Z" fill="#e0709a" />
      {/* mountains */}
      <path d="M0 214l60-70 40 34 50-58 60 64 44-40 70 58 40-30 36 30V230H0Z" fill="#3b2a55" />
      <g fill="#f2e5c3">
        <path d="M60 144l-14 16 8-2 6 6 6-6 9 4Z" />
        <path d="M150 120l-16 18 8-2 8 6 6-6 12 2Z" />
        <path d="M254 142l-10 9 6 0 4 4 6-4 6 0Z" />
      </g>
      <path d="M0 230l90-36 60 22 80-30 70 26 100-24V240H0Z" fill="#2d2145" />
      {/* lake */}
      <rect y="232" width="400" height="68" fill="#1a1030" />
      <g fill="#4fb286">
        <rect x="40" y="246" width="60" height="3" />
        <rect x="150" y="256" width="80" height="3" />
        <rect x="260" y="244" width="50" height="3" />
      </g>
      <g fill="#2f9a9a">
        <rect x="90" y="266" width="70" height="3" />
        <rect x="300" y="262" width="60" height="3" />
      </g>
      <rect x="196" y="276" width="40" height="3" fill="#e0709a" />
      {/* shore and pines */}
      <path d="M0 236h400v6H0Z" fill="#121a24" />
      {[
        [14, 236, 1.1],
        [34, 236, 0.8],
        [356, 236, 1.2],
        [380, 236, 0.9],
        [334, 236, 0.7],
      ].map(([x, y, s]) => (
        <g key={x} fill="#121a24">
          <path d={`M${x} ${y - 70 * s}l${-14 * s} ${30 * s}h${28 * s}Z`} />
          <path d={`M${x} ${y - 52 * s}l${-18 * s} ${32 * s}h${36 * s}Z`} />
          <path d={`M${x} ${y - 34 * s}l${-22 * s} ${34 * s}h${44 * s}Z`} />
        </g>
      ))}
      {/* cabin with a lit window */}
      <path d="M290 236v-22h30v22Z" fill="#121a24" />
      <path d="M286 216l19-16 19 16Z" fill="#121a24" />
      <rect x="300" y="220" width="9" height="9" fill="#f2c14e" />
      <Streaks x={305} y={246} widths={[8, 12, 6]} fill="#f2c14e" />
    </Svg>
  );
}

/* ---------- Masthead: the lighthouse (explaining = shining a light on the code) ---------- */
export function LighthouseScene(props: SceneProps) {
  return (
    <Svg {...props}>
      <rect width="400" height="300" fill="#13315c" />
      <circle cx="110" cy="96" r="86" fill="#1a4672" />
      <circle cx="110" cy="96" r="56" fill="#2f7f86" />
      <circle cx="110" cy="96" r="26" fill="#f2c14e" />
      <rect x="10" y="150" width="90" height="8" fill="#1a4672" />
      <rect x="180" y="58" width="70" height="7" fill="#1a4672" />
      <Stars at={[[22, 24], [210, 22], [380, 26], [240, 110, 1], [30, 120, 1], [176, 132, 1], [356, 72, 1]]} />
      <Sparkle x={196} y={40} s={5} />
      <Sparkle x={36} y={58} s={3.5} />
      {/* beam */}
      <path d="M300 112L170 82v48Z" fill="#f2c14e" />
      <path d="M318 112L400 92v30Z" fill="#f2c14e" />
      {/* sea */}
      <rect y="192" width="400" height="108" fill="#163f6b" />
      <path d={wave(206, 5, 60, 260)} fill="#1d5a78" />
      <path d={wave(226, 5, 50, 260)} fill="#163f6b" />
      <path d={wave(246, 6, 66, 260)} fill="#2a6f88" />
      <Streaks x={110} y={198} widths={[16, 24, 32, 26, 38, 30]} fill="#f2c14e" />
      <g fill="#f2e5c3">
        <rect x="20" y="214" width="28" height="2" />
        <rect x="170" y="230" width="34" height="2" />
        <rect x="190" y="208" width="20" height="2" />
      </g>
      {/* cliff */}
      <path d="M206 300L228 220L262 190L296 174L330 180L362 172L400 186V300Z" fill="#0f2747" />
      <path d="M232 300L250 236L282 208L312 216V300Z" fill="#163a63" />
      {/* lighthouse: stripes of cream and sand orange */}
      <path d="M296 176l4-58h18l4 58Z" fill="#f2e5c3" />
      <path d="M298.7 146l.8-12h19l.8 12Z" fill="#f07a2e" />
      <path d="M297.4 166l.6-8h22l.6 8Z" fill="#f07a2e" />
      <rect x="298" y="104" width="22" height="14" fill="#0f2747" />
      <rect x="302" y="107" width="14" height="9" fill="#f2c14e" />
      <path d="M296 104l13-12 13 12Z" fill="#f07a2e" />
      <rect x="294" y="116" width="30" height="3" fill="#0f2747" />
      {/* boat */}
      <path d="M150 196h24l-4 6h-16Z" fill="#0f2747" />
      <path d="M161 170v25h-13Z" fill="#f2e5c3" />
      <path d="M163 176v19h10Z" fill="#f2e5c3" />
      {/* beach */}
      <path d="M0 300V266q90-20 180-10t70 10V300Z" fill="#f07a2e" />
      <path d="M0 266q90-20 180-10t70 10v4q-40-4-70-10T0 270Z" fill="#f2e5c3" />
      <path d="M0 300V286q120-12 250 4V300Z" fill="#d9662a" />
      <g fill="#0f2340">
        <path d="M18 268l3-28 3 28Z" />
        <path d="M26 268l7-24 0 24Z" />
        <path d="M36 266l-5-20 8 20Z" />
        <path d="M200 262l4-20 2 20Z" />
        <path d="M208 262l-3-16 6 16Z" />
      </g>
    </Svg>
  );
}

export const PLATE_SCENES = [MoonpathScene, HiddenFallsScene, HarbourScene, AuroraScene] as const;
/** The flat sky colour of each plate scene, used behind the caption set on the poster. */
export const PLATE_SKIES = ["#13315c", "#123d33", "#0e1c3a", "#23173a"] as const;
