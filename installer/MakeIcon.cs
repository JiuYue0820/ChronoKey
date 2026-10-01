// 生成应用图标:build/icon.ico(16–256 多尺寸 PNG)、build/icon.png(512)、docs/favicon.png(64)
// 设计:苔绿圆角方底(上亮下暗的轻渐变),和纸色 3×3 品牌方阵,中心一格为琥珀色"时间之芯"。
// 小尺寸(≤32)放大小格比例并取整到像素,避免 0.35 的小格糊成灰点。
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

static class MakeIcon
{
  static readonly Color Top = ColorTranslator.FromHtml("#737A33");
  static readonly Color Bottom = ColorTranslator.FromHtml("#474C17");
  static readonly Color Washi = ColorTranslator.FromHtml("#F6F3EC");
  static readonly Color Amber = ColorTranslator.FromHtml("#E2943B");

  static GraphicsPath Round(RectangleF r, float rad)
  {
    var p = new GraphicsPath();
    float d = Math.Min(rad * 2, Math.Min(r.Width, r.Height));
    p.AddArc(r.X, r.Y, d, d, 180, 90);
    p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
    p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
    p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
    p.CloseFigure();
    return p;
  }

  // 在 256 单位的画布上绘制,按 px 缩放;small 时使用更粗的格子
  static Bitmap Draw(int px)
  {
    int ss = Math.Min(1024, px * 4);
    var big = new Bitmap(ss, ss, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(big))
    {
      g.SmoothingMode = SmoothingMode.AntiAlias;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.Clear(Color.Transparent);
      float k = ss / 256f;
      g.ScaleTransform(k, k);
      bool small = px <= 32;

      float inset = small ? 4 : 10;
      var bg = new RectangleF(inset, inset, 256 - inset * 2, 256 - inset * 2);
      float radius = small ? 44 : 54;
      using (var path = Round(bg, radius))
      {
        using (var b = new LinearGradientBrush(bg, Top, Bottom, 90f)) g.FillPath(b, path);
      }

      // 3×3 方阵:主对角线满格、相邻 0.6、反对角两角 0.35(与应用内 BrandMark 同构)
      float[] scale = small ? new[] { 1f, .78f, .56f } : new[] { 1f, .62f, .36f };
      int[,] lvl = { { 0, 1, 2 }, { 1, 0, 1 }, { 2, 1, 0 } };
      float pitch = small ? 64 : 50, cellMax = small ? 54 : 42;
      float origin = 128 - pitch;
      for (int y = 0; y < 3; y++)
        for (int x = 0; x < 3; x++)
        {
          float w = cellMax * scale[lvl[y, x]];
          float cx = origin + x * pitch, cy = origin + y * pitch;
          var r = new RectangleF(cx - w / 2, cy - w / 2, w, w);
          bool center = x == 1 && y == 1;
          using (var b = new SolidBrush(center ? Amber : Washi))
          using (var p = Round(r, w * (small ? 0.12f : 0.16f))) g.FillPath(b, p);
        }
    }
    if (ss == px) return big;
    var outBmp = new Bitmap(px, px, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outBmp))
    {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.DrawImage(big, new Rectangle(0, 0, px, px), 0, 0, ss, ss, GraphicsUnit.Pixel);
    }
    big.Dispose();
    return outBmp;
  }

  // < 256 用 32 位 DIB(BITMAPINFOHEADER + BGRA 自下而上 + AND 掩码),兼容所有读取 .ico 的程序
  static byte[] Dib(Bitmap b)
  {
    int n = b.Width;
    int maskRow = ((n + 31) / 32) * 4;
    using (var ms = new MemoryStream())
    using (var w = new BinaryWriter(ms))
    {
      w.Write(40); w.Write(n); w.Write(n * 2); w.Write((short)1); w.Write((short)32);
      w.Write(0); w.Write(n * n * 4 + maskRow * n); w.Write(0); w.Write(0); w.Write(0); w.Write(0);
      for (int y = n - 1; y >= 0; y--)
        for (int x = 0; x < n; x++)
        {
          var c = b.GetPixel(x, y);
          w.Write(c.B); w.Write(c.G); w.Write(c.R); w.Write(c.A);
        }
      w.Write(new byte[maskRow * n]);
      return ms.ToArray();
    }
  }

  static byte[] Png(Bitmap b)
  {
    using (var ms = new MemoryStream()) { b.Save(ms, ImageFormat.Png); return ms.ToArray(); }
  }

  static void Main(string[] args)
  {
    string root = args.Length > 0 ? args[0] : "..";
    int[] sizes = { 16, 20, 24, 32, 40, 48, 64, 128, 256 };
    var images = new List<byte[]>();
    foreach (int s in sizes) using (var b = Draw(s)) images.Add(s >= 256 ? Png(b) : Dib(b));

    using (var fs = new FileStream(Path.Combine(root, "build", "icon.ico"), FileMode.Create))
    using (var w = new BinaryWriter(fs))
    {
      w.Write((short)0); w.Write((short)1); w.Write((short)sizes.Length);
      int offset = 6 + 16 * sizes.Length;
      for (int i = 0; i < sizes.Length; i++)
      {
        w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
        w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
        w.Write((byte)0); w.Write((byte)0);
        w.Write((short)1); w.Write((short)32);
        w.Write(images[i].Length); w.Write(offset);
        offset += images[i].Length;
      }
      foreach (var img in images) w.Write(img);
    }
    using (var b = Draw(512)) b.Save(Path.Combine(root, "build", "icon.png"), ImageFormat.Png);
    string docs = Path.Combine(root, "docs");
    if (Directory.Exists(docs))
      using (var b = Draw(64)) b.Save(Path.Combine(docs, "favicon.png"), ImageFormat.Png);
    Console.WriteLine("icons written");
  }
}
