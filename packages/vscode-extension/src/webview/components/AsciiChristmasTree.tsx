import { useState, useEffect, useMemo } from "react";
import { use$ } from "@legendapp/state/react";
import "./AsciiChristmasTree.css";
import { useStore } from "../providers/storeProvider";
import { DeviceRotation } from "../../common/State";

interface Pixel {
  value: string;
  color?: string;
}

interface Star {
  x: number;
  y: number;
}

const COLORS = {
  white: "#ffffff",
  green: "#338a3d",
  yellow: "#dfc321",
  red: "#c22525",
  magenta: "#1f52b8",
  gray: "#808080",
};

function AsciiChristmasTree({ width = 46, height = 19 }: { width?: number; height?: number }) {
  const store$ = useStore();
  const rotation = use$(store$.workspaceConfiguration.deviceSettings.deviceRotation);

  const [baubleColors, setBaubleColors] = useState<string[]>([
    COLORS.yellow,
    COLORS.red,
    COLORS.magenta,
  ]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stars, setStars] = useState<Star[]>([]);

  const isLandscape =
    rotation === DeviceRotation.LandscapeLeft || rotation === DeviceRotation.LandscapeRight;

  // Get phone-content dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const phoneContent = document.querySelector(".phone-content");
      if (phoneContent) {
        const rect = phoneContent.getBoundingClientRect();
        // Convert pixels to character count (approximate)
        const charWidth = Math.floor(rect.width / 6); // ~6px per char
        const charHeight = Math.floor(rect.height / 10); // ~10px per line
        setDimensions({ width: charWidth, height: charHeight });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Helper function to generate stars
  const generateStars = (dimWidth: number, dimHeight: number): Star[] => {
    const initialStars: Star[] = [];
    const starChance = 0.2;
    const starWidth = 3;
    const starHeight = 3;
    const minDistance = starWidth + 2;

    const treeHeight = 30;
    const starAreaHeight = Math.max(0, dimHeight - treeHeight);

    const isTooClose = (newX: number, newY: number): boolean => {
      return initialStars.some((star) => {
        const dx = Math.abs(star.x - newX);
        const dy = Math.abs(star.y - newY);
        return dx < minDistance && dy < minDistance;
      });
    };

    for (let y = 0; y < starAreaHeight; y += starHeight) {
      for (let x = 0; x < dimWidth; x += starWidth + 1) {
        if (Math.random() < starChance && !isTooClose(x, y)) {
          initialStars.push({ x, y });
        }
      }
    }
    return initialStars;
  };

  // Watch for rotation changes and clear/regenerate stars
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    if (isLandscape) {
      // Clear stars when in landscape
      setStars([]);
    } else {
      // Regenerate stars when not in landscape
      setStars(generateStars(dimensions.width, dimensions.height));
    }
  }, [isLandscape, dimensions.width, dimensions.height]);

  // Rotate bauble colors every 500ms for blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setBaubleColors((prev) => {
        const rotated = [...prev];
        rotated.push(rotated.shift()!);
        return rotated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const treeImage = useMemo(() => {
    const sceneWidth = dimensions.width > 0 ? dimensions.width : width;
    const sceneHeight = dimensions.height > 0 ? dimensions.height : height;
    return generateChristmasScene(sceneWidth, sceneHeight, baubleColors, stars);
  }, [width, height, baubleColors, dimensions, stars]);

  return (
    <pre className="ascii-christmas-tree" aria-label="ASCII Christmas Tree">
      {treeImage.map((row, i) => (
        <div key={i} className="tree-row">
          {row.map((pixel, j) => (
            <span
              key={j}
              style={{
                color: pixel.color || "inherit",
              }}>
              {pixel.value || " "}
            </span>
          ))}
        </div>
      ))}
    </pre>
  );
}

function generateChristmasScene(
  width: number,
  height: number,
  baubleColors: string[],
  stars: Star[]
): Pixel[][] {
  // Generate single centered tree with fixed size
  const treeWidth = 21;
  const tree = generateTree(treeWidth, baubleColors, 0);

  // Calculate the actual height needed for the tree
  const actualHeight = Math.max(tree.length, height);

  // Create background
  const image: Pixel[][] = Array(actualHeight)
    .fill(null)
    .map(() =>
      Array(width)
        .fill(null)
        .map(() => ({ value: " " }))
    );

  // Add ASCII stars from state with varied patterns
  const starPatterns = [
    [" . ", ".*.", " ' "],
    [" + ", "+*+", " + "],
    [" : ", ":*:", " : "],
  ];

  stars.forEach((star, index) => {
    const starPattern = starPatterns[index % starPatterns.length];
    for (let py = 0; py < starPattern.length; py++) {
      for (let px = 0; px < starPattern[py].length; px++) {
        const char = starPattern[py][px];
        if (char !== " ") {
          const targetY = star.y + py;
          const targetX = star.x + px;
          if (targetY >= 0 && targetY < actualHeight && targetX >= 0 && targetX < width) {
            image[targetY][targetX] = { value: char, color: COLORS.yellow };
          }
        }
      }
    }
  });

  // Paste tree on top of stars (tree will overwrite stars where it exists)
  const treeX = Math.floor((width - treeWidth) / 2);
  pasteTree(image, tree, treeX, 0);

  return image;
}

function generateTree(w: number, baubleColors: string[], offset: number): Pixel[][] {
  // Ensure odd width
  if (w % 2 === 0) {
    w -= 1;
  }

  const tree: Pixel[][] = [];

  // Star on top
  tree.push(centerPixels(w, pixels(" * ", COLORS.yellow)));

  // Tree crown
  tree.push(centerPixels(w, pixels(" /_\\ ", COLORS.green)));
  tree.push(centerPixels(w, pixels(" /_\\_\\ ", COLORS.green)));

  // Tree body
  for (let i = 3; i < (w - 2) / 2; i++) {
    const left = ` ${"_\\".repeat(i)} `;
    const right = ` ${"/_".repeat(i)}\\ `;
    tree.push(centerPixels(w, pixels(left, COLORS.green)));
    tree.push(centerPixels(w, pixels(right, COLORS.green)));
  }

  // Add baubles - need to modify tree directly, not slices
  for (let rowIdx = 2; rowIdx < tree.length; rowIdx++) {
    const row = tree[rowIdx];
    const third = Math.floor(w / 3);

    const colors = [...baubleColors];
    // Rotate colors based on row for variation
    for (let r = 0; r < (offset + rowIdx) % 3; r++) {
      colors.push(colors.shift()!);
    }

    // Place baubles in three sections of the row
    const sectionRanges = [
      { start: 0, end: third },
      { start: third, end: third * 2 },
      { start: third * 2, end: w },
    ];

    sectionRanges.forEach((range, sectionIdx) => {
      // Find all underscore positions in this section
      const underscorePositions: number[] = [];
      for (let j = range.start; j < range.end && j < row.length; j++) {
        if (row[j].value === "_") {
          underscorePositions.push(j);
        }
      }

      // Place a bauble at a random underscore position
      if (underscorePositions.length > 0) {
        const randomIdx = Math.floor(Math.random() * underscorePositions.length);
        const pos = underscorePositions[randomIdx];
        row[pos] = { value: "*", color: colors[sectionIdx] };
      }
    });
  }

  // Add pot
  if (w >= 15) {
    tree.push(centerPixels(w, pixels(" [_____] ", COLORS.gray)));
    tree.push(centerPixels(w, pixels(" \\___/ ", COLORS.gray)));
  } else {
    const n = w >= 10 ? 3 : 1;
    tree.push(centerPixels(w, pixels(` \\${"_".repeat(n)}/ `, COLORS.gray)));
  }

  return tree;
}

function pixels(str: string, color: string): Pixel[] {
  return str.split("").map((c) => ({ value: c, color }));
}

function centerPixels(width: number, pixelArray: Pixel[]): Pixel[] {
  const row: Pixel[] = Array(width)
    .fill(null)
    .map(() => ({ value: " " }));
  const start = Math.floor((width - pixelArray.length) / 2);

  for (let i = 0; i < pixelArray.length; i++) {
    row[start + i] = pixelArray[i];
  }

  return row;
}

function pasteTree(bg: Pixel[][], fg: Pixel[][], x: number, y: number): void {
  const maxY = bg.length - y;

  for (let i = 0; i < fg.length; i++) {
    const row = fg[fg.length - 1 - i];
    for (let j = 0; j < row.length; j++) {
      if (row[j].value !== " ") {
        const bgRow = maxY - i - 1;
        if (bgRow >= 0 && bgRow < bg.length && x + j < bg[0].length) {
          bg[bgRow][x + j] = row[j];
        }
      }
    }
  }
}

export default AsciiChristmasTree;
