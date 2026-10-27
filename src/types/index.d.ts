/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

/**
 * Type declarations for enhanced-h264ify
 */

export interface OptionDefinition {
  key: string;
  label: string;
  group: 'video' | 'audio' | 'playback' | 'interface';
  default: boolean;
}

export interface EHFConfig {
  block_60fps: boolean;
  block_h264: boolean;
  block_vp8: boolean;
  block_vp9: boolean;
  block_av1: boolean;
  block_opus: boolean;
  block_mp4a: boolean;
  disable_LN: boolean;
  auto_max_resolution: boolean;
  anti_inactivity: boolean;
  bypass_age_gate: boolean;
  show_dislikes: boolean;
}

export interface EHFModule {
  readonly OPTIONS: readonly OptionDefinition[];
  readonly KEYS: readonly string[];
  readonly DEFAULTS: Readonly<EHFConfig>;
  normalize(stored?: Record<string, unknown> | null): EHFConfig;
  read(): Promise<EHFConfig>;
  write(patch: Partial<Record<string, unknown>>): Promise<void>;
  subscribe(listener: (config: EHFConfig) => void): () => void;
  normalizeInstance(value: unknown): string | null;
  readInstances(): Promise<string[]>;
  writeInstances(origins: readonly unknown[]): Promise<void>;
}

export interface EHFInstancesModule {
  sync(): Promise<boolean>;
  readonly MANAGED_IDS: readonly string[];
}

declare global {
  var EHF: EHFModule;
  var EHFInstances: EHFInstancesModule;
  var ytInitialPlayerResponse: any;
}
