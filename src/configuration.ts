import { workspace as Workspace } from 'vscode';

import { ConfigurationConstants } from './constants';

export default class Configuration {
  public static get<T>(key: string): T {
    const value = Workspace.getConfiguration(ConfigurationConstants.SectionName).get<T>(key);
    if(typeof value === 'undefined') {
      throw new Error(`configuration ${ConfigurationConstants.SectionName}.${key} did not return a value`);
    }
    return value;
  }
}