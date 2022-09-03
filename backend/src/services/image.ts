import * as fs from "fs";
import * as path from "path";

import * as blake3 from "blake3";
import * as easyimg from "easyimage";

export interface ProcessImageResult {
  hash: string;
  imageExt: string;
  thumbExt: string;
}

export class ImageService {
  private readonly imagePath: string;
  private readonly thumbPath: string;

  constructor(
    private readonly outputPath,
    private readonly imageSize: number = 500,
    private readonly thumbSize: number = 100,
    private readonly thumbBackground: string = "#D6DAF0"
  ) {
    this.imagePath = path.join(this.outputPath, "i");
    this.thumbPath = path.join(this.outputPath, "t");
  }

  public async processImage(src: string): Promise<ProcessImageResult> {
    // Calculate hash of the original file
    const hash = await hashFile(src);

    const src_ext = path.extname(src).substring(1);

    let ext = "webp";
    let preserveOriginal = false;
    if (src_ext === "gif") {
      ext = "gif";
      preserveOriginal = true;
    }

    const imageFilename = `${hash}.${ext}`;
    const thumbFilename = `${hash}.${ext}`;

    const imagePath = path.join(this.imagePath, imageFilename);

    // Generate image if it does not exist
    if (!fs.existsSync(imagePath)) {
      if (preserveOriginal) {
        await copyFile(src, imagePath);
      } else {
        await easyimg.resize({
          src,
          dst: imagePath,
          width: this.imageSize,
          height: this.imageSize,
          quality: 80,
          background: this.thumbBackground,
          onlyDownscale: true,
        });
      }
    }

    const thumbPath = path.join(this.thumbPath, thumbFilename);

    // Generate thumbnail if it does not exist
    if (!fs.existsSync(thumbPath)) {
      if (preserveOriginal) {
        await linkFile(imagePath, thumbPath);
      } else {
        await easyimg.resize({
          src,
          dst: thumbPath,
          width: this.thumbSize,
          height: this.thumbSize,
          quality: 80,
          background: this.thumbBackground,
          onlyDownscale: true,
        });
      }
    }

    return {
      hash,
      imageExt: ext,
      thumbExt: ext,
    };
  }
}

function hashFile(path: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(blake3.createHash())
      .on("data", (hash) => {
        resolve(hash.toString("hex"));
      })
      .on("error", (err) => reject(err));
  });
}

function copyFile(src: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.copyFile(src, dest, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function linkFile(src: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.link(src, dest, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}
