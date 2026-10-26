import fs from 'node:fs';
import path from 'node:path';
import {entryHtml, projectPath} from './paths.mjs';

// assets/ is generated. Replace it so renamed/deleted sources cannot leave
// obsolete scripts in either the repository upload or the Pages artifact.
export function syncUploadAssets() {
  const source=projectPath('dist/client');
  const root=path.dirname(entryHtml), destination=path.resolve(root,'assets');
  if(path.dirname(destination)!==root||path.basename(destination)!=='assets')throw Error('Unsafe upload path');
  if(!fs.statSync(source).isDirectory())throw Error('Missing browser build');
  if(fs.existsSync(destination)){
    if(fs.lstatSync(destination).isSymbolicLink()||fs.realpathSync(destination)!==destination)throw Error('Unsafe upload symlink');
    fs.rmSync(destination,{recursive:true,force:true});
  }
  fs.cpSync(source,destination,{recursive:true});
}
