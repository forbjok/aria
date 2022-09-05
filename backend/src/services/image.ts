import * as fs from "fs";
import * as path from "path";

import * as blake3 from "blake3";
import * as easyimg from "easyimage";

export interface ProcessPostImageResult {
  hash: string;
  imageExt: string;
  thumbExt: string;
}

export interface ProcessEmoteImageResult {
  hash: string;
  ext: string;
}

interface ProcessImageResult {
  hash: string;
  ext: string;
  originalExt: string;
  preserveOriginal: boolean;
}

export class ImageService {
  private readonly imagePath: string;
  private readonly thumbPath: string;
  private readonly emotePath: string;
  private readonly originalImagePath: string;
  private readonly originalEmotePath: string;

  constructor(
    private readonly outputPath,
    private readonly imageSize: number = 500,
    private readonly thumbSize: number = 100,
    private readonly thumbBackground?: string
  ) {
    this.imagePath = path.join(this.outputPath, "public", "i");
    this.thumbPath = path.join(this.outputPath, "public", "t");
    this.emotePath = path.join(this.outputPath, "public", "e");
    this.originalImagePath = path.join(this.outputPath, "original", "i");
    this.originalEmotePath = path.join(this.outputPath, "original", "e");

    // Ensure directories exist
    createDir(this.imagePath);
    createDir(this.thumbPath);
    createDir(this.emotePath);
    createDir(this.originalImagePath);
    createDir(this.originalEmotePath);
  }

  public async processPostImage(src: string, overwrite = false): Promise<ProcessPostImageResult> {
    // Calculate hash of the original file
    const { hash, ext, originalExt, preserveOriginal } = await this.processImage(src);

    const originalFilename = `${hash}.${originalExt}`;
    const imageFilename = `${hash}.${ext}`;
    const thumbFilename = `${hash}.${ext}`;

    const originalImagePath = path.join(this.originalImagePath, originalFilename);

    // Copy file to originals directory
    if (overwrite || !fs.existsSync(originalImagePath)) {
      await copyFile(src, originalImagePath);
    }

    const imagePath = path.join(this.imagePath, imageFilename);

    // Generate image if it does not exist
    if (overwrite || !fs.existsSync(imagePath)) {
      // Remove file if it already exists (overwrite)
      await unlinkFile(imagePath);

      if (preserveOriginal) {
        await linkFile(originalImagePath, imagePath);
      } else {
        await easyimg.resize({
          src,
          dst: imagePath,
          width: this.imageSize,
          height: this.imageSize,
          quality: 80,
          onlyDownscale: true,
        });
      }
    }

    const thumbPath = path.join(this.thumbPath, thumbFilename);

    // Generate thumbnail if it does not exist
    if (overwrite || !fs.existsSync(thumbPath)) {
      // Remove file if it already exists (overwrite)
      await unlinkFile(thumbPath);

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

  public async processEmoteImage(src: string, overwrite = false): Promise<ProcessEmoteImageResult> {
    // Calculate hash of the original file
    const { hash, ext, originalExt, preserveOriginal } = await this.processImage(src);

    const originalFilename = `${hash}.${originalExt}`;
    const emoteFilename = `${hash}.${ext}`;

    const originalEmotePath = path.join(this.originalEmotePath, originalFilename);

    // Copy file to originals directory
    if (overwrite || !fs.existsSync(originalEmotePath)) {
      await copyFile(src, originalEmotePath);
    }

    const emotePath = path.join(this.emotePath, emoteFilename);

    // Generate image if it does not exist
    if (overwrite || !fs.existsSync(emotePath)) {
      // Remove file if it already exists (overwrite)
      await unlinkFile(emotePath);

      if (preserveOriginal) {
        await linkFile(originalEmotePath, emotePath);
      } else {
        await easyimg.resize({
          src,
          dst: emotePath,
          width: 350,
          height: 200,
          quality: 90,
          onlyDownscale: true,
        });
      }
    }

    return {
      hash,
      ext,
    };
  }

  private async processImage(src: string): Promise<ProcessImageResult> {
    // Calculate hash of the original file
    const hash = await hashFile(src);

    const originalExt = path.extname(src).substring(1);

    let ext = "webp";
    let preserveOriginal = false;
    if (originalExt === "gif") {
      ext = "gif";
      preserveOriginal = true;
    }

    return {
      hash,
      ext,
      originalExt,
      preserveOriginal,
    };
  }

  public async reprocess(): Promise<void> {
    const processPath = path.join(this.outputPath, "process");
    const imageProcessPath = path.join(processPath, "i");
    const emoteProcessPath = path.join(processPath, "e");

    if (fs.existsSync(emoteProcessPath)) {
      const files = await readDir(emoteProcessPath);

      for (const file of files) {
        const filePath = path.join(emoteProcessPath, file);

        try {
          await this.processEmoteImage(filePath, true);
        } catch (err) {
          console.log(err);
        }
      }
    }

    if (fs.existsSync(imageProcessPath)) {
      const files = await readDir(imageProcessPath);

      for (const file of files) {
        const filePath = path.join(imageProcessPath, file);

        try {
          await this.processPostImage(filePath, true);
        } catch (err) {
          console.log(err);
        }
      }
    }
  }
}

function hashFile(path: fs.PathLike): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(blake3.createHash())
      .on("data", (hash) => {
        resolve(hash.toString("hex"));
      })
      .on("error", (err) => reject(err));
  });
}

function copyFile(src: fs.PathLike, dest: fs.PathLike): Promise<void> {
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

function linkFile(src: fs.PathLike, dest: fs.PathLike): Promise<void> {
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

function unlinkFile(path: fs.PathLike): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!fs.existsSync(path)) {
      resolve();
      return;
    }

    fs.unlink(path, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function readDir(path: fs.PathLike): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(files);
    });
  });
}

function createDir(path: fs.PathLike) {
  if (fs.existsSync(path)) {
    return;
  }

  fs.mkdirSync(path, { recursive: true });
}
