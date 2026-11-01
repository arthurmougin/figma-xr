import type { CatalogItem } from "./types";

// Original sample artwork. Never load or publish a user's cached Figma exports.
export function demoCatalog(): CatalogItem[] {
  return [
    ["Welcome card", "Make room for ideas", "#7466ee"],
    ["Music player", "A little space to listen", "#c7598f"],
    ["Weather card", "22° · A clear afternoon", "#267a95"],
    ["Project note", "Something worth exploring", "#bd7334"],
    ["Navigation bar", "Home     Explore     Saved", "#397d66"],
    ["Profile card", "Your next perspective", "#595b8e"],
  ].map(([name, subtitle, color], index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = index === 4 ? 150 : 360;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 32);
    ctx.fill();
    ctx.fillStyle = "#ffffff20";
    ctx.beginPath();
    ctx.arc(568, 60, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 34px system-ui";
    ctx.fillText(name, 36, index === 4 ? 56 : 152);
    ctx.font = "24px system-ui";
    ctx.fillText(subtitle, 36, index === 4 ? 103 : 202);
    if (index !== 4) {
      ctx.fillStyle = "#ffffff30";
      ctx.fillRect(36, 264, 160, 6);
      ctx.fillRect(36, 283, 104, 6);
    }
    return {
      id: `demo:${index}`, pageId: "demo", name, version: 1,
      width: canvas.width, height: canvas.height,
      image: canvas.toDataURL("image/png"), updatedAt: 0,
    };
  });
}
