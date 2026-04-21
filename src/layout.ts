import {
  ImageContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";

import {
  BLANK_TEXT,
  CAPTURE_CONTENT,
  CAPTURE_ID,
  CAPTURE_NAME,
  COMPACT_FAST_READOUT_CONTAINER,
  COMPACT_SLOW_TEXT_CONTAINERS,
  DIAL_HEARTBEAT_CONTAINER,
  FAST_READOUT_CONTAINER,
  HUD_HEIGHT,
  HUD_WIDTH,
  IMAGE_TILES,
  SLOW_TEXT_CONTAINERS,
  TILE_HEIGHT,
  TILE_WIDTH,
  type CompactSlowTextContainer,
  type HudLayoutMode,
  type SlowTextContainer,
} from "./config";

let activeHudLayoutMode: HudLayoutMode = "compact";

export function setHudLayoutMode(mode: HudLayoutMode): void {
  activeHudLayoutMode = mode;
}

export function getHudLayoutMode(): HudLayoutMode {
  return activeHudLayoutMode;
}

export function currentFastReadoutContainer() {
  return activeHudLayoutMode === "compact"
    ? COMPACT_FAST_READOUT_CONTAINER
    : FAST_READOUT_CONTAINER;
}

export function currentDialHeartbeatContainer() {
  return activeHudLayoutMode === "compact"
    ? null
    : DIAL_HEARTBEAT_CONTAINER;
}

export function currentSlowTextContainers(): readonly (SlowTextContainer | CompactSlowTextContainer)[] {
  return activeHudLayoutMode === "compact"
    ? COMPACT_SLOW_TEXT_CONTAINERS
    : SLOW_TEXT_CONTAINERS;
}

export function buildHudPageDefinition() {
  const fastReadoutContainer = currentFastReadoutContainer();
  const dialHeartbeatContainer = currentDialHeartbeatContainer();
  const slowTextContainers = currentSlowTextContainers();
  const captureContainer = new ListContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: HUD_WIDTH,
    height: HUD_HEIGHT,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: CAPTURE_ID,
    containerName: CAPTURE_NAME,
    itemContainer: new ListItemContainerProperty({
      itemCount: 1,
      itemWidth: 0,
      isItemSelectBorderEn: 0,
      itemName: [CAPTURE_CONTENT],
    }),
    isEventCapture: 1,
  });

  return {
    containerTotalNum:
      IMAGE_TILES.length
      + slowTextContainers.length
      + 1
      + 1
      + (dialHeartbeatContainer ? 1 : 0),
    textObject: [
      new TextContainerProperty({
        xPosition: fastReadoutContainer.x,
        yPosition: fastReadoutContainer.y,
        width: fastReadoutContainer.width,
        height: fastReadoutContainer.height,
        borderWidth: 0,
        borderColor: 0,
        paddingLength: 0,
        containerID: fastReadoutContainer.id,
        containerName: fastReadoutContainer.name,
        content: BLANK_TEXT,
        isEventCapture: 0,
      }),
      ...(dialHeartbeatContainer ? [new TextContainerProperty({
        xPosition: dialHeartbeatContainer.x,
        yPosition: dialHeartbeatContainer.y,
        width: dialHeartbeatContainer.width,
        height: dialHeartbeatContainer.height,
        borderWidth: 0,
        borderColor: 0,
        paddingLength: 0,
        containerID: dialHeartbeatContainer.id,
        containerName: dialHeartbeatContainer.name,
        content: BLANK_TEXT,
        isEventCapture: 0,
      })] : []),
      ...slowTextContainers.map((container) => new TextContainerProperty({
        xPosition: container.x,
        yPosition: container.y,
        width: container.width,
        height: container.height,
        borderWidth: 0,
        borderColor: 0,
        paddingLength: 0,
        containerID: container.id,
        containerName: container.name,
        content: BLANK_TEXT,
        isEventCapture: 0,
      })),
    ],
    listObject: [captureContainer],
    imageObject: IMAGE_TILES.map((tile) => new ImageContainerProperty({
      xPosition: tile.x,
      yPosition: tile.y,
      width: TILE_WIDTH,
      height: TILE_HEIGHT,
      containerID: tile.id,
      containerName: tile.name,
    })),
  };
}
