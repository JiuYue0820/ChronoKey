// ChronoKey 安装 / 卸载程序。单文件 WinForms(.NET Framework 4.8,C# 5),用系统自带 csc 编译,见 build.cmd。
// 安装:选择位置 → 下载(进度、速度、剩余时间)→ SHA-256 校验 → 解压 → 快捷方式 + 卸载项 → 关闭后自删除
// 卸载:同一个 exe 以 /uninstall 运行(安装时复制为 <安装目录>\Uninstall.exe)
// 测试:/source:<本地文件夹或 URL> 可替换默认的 GitHub Releases 下载源(需含 latest.json)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("ChronoKey Setup")]
[assembly: AssemblyProduct("ChronoKey")]
[assembly: AssemblyCompany("JiuYue0820")]
[assembly: AssemblyVersion("0.3.0.0")]
[assembly: AssemblyFileVersion("0.3.0.0")]

namespace ChronoKeySetup
{
  static class Program
  {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main(string[] args)
    {
      try { SetProcessDPIAware(); } catch { }
      Application.EnableVisualStyles();
      Application.SetCompatibleTextRenderingDefault(false);
      bool uninstall = false;
      string source = null;
      foreach (var a in args)
      {
        if (a.Equals("/uninstall", StringComparison.OrdinalIgnoreCase)) uninstall = true;
        else if (a.StartsWith("/source:", StringComparison.OrdinalIgnoreCase)) source = a.Substring(8);
        else if (a.StartsWith("/dir:", StringComparison.OrdinalIgnoreCase)) SetupForm.DirOverride = a.Substring(5);
        else if (a.StartsWith("/lang:", StringComparison.OrdinalIgnoreCase)) SetupForm.LangOverride = a.Substring(6);
        else if (a.Equals("/auto", StringComparison.OrdinalIgnoreCase)) SetupForm.Auto = true;
      }
      // 双击 Uninstall.exe(没有参数)也应进入卸载:按文件名或"与 ChronoKey.exe 同目录"判断
      string self = Application.ExecutablePath;
      if (Path.GetFileName(self).Equals("Uninstall.exe", StringComparison.OrdinalIgnoreCase)
        || File.Exists(Path.Combine(Path.GetDirectoryName(self), "ChronoKey.exe"))) uninstall = true;
      Application.Run(new SetupForm(uninstall, source));
    }
  }
  // 和纸 × 苔 配色,与应用一致;跟随系统深浅色
  static class Theme
  {
    public static bool Dark;
    public static Color Bg, Side, Surface, Text, Text2, Text3, Border, Accent, OnAccent, Matrix, Hot, Danger, Track;
    public static void Init()
    {
      try
      {
        object v = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 1);
        Dark = v is int && (int)v == 0;
      }
      catch { }
      if (Dark)
      {
        Bg = H("#1F1E1B"); Side = H("#191816"); Surface = H("#2A2925"); Text = H("#EDE8DD"); Text2 = H("#B8B1A2");
        Text3 = H("#948D7E"); Border = H("#3D3A34"); Accent = H("#91AD70"); OnAccent = H("#1F1E1B");
        Matrix = H("#91AD70"); Hot = H("#E2943B"); Danger = H("#E58A76"); Track = H("#35332E");
      }
      else
      {
        Bg = H("#F6F3EC"); Side = H("#ECE7DC"); Surface = H("#FFFDF8"); Text = H("#1C1C1C"); Text2 = H("#5A554B");
        Text3 = H("#6B6559"); Border = H("#D6CFBF"); Accent = H("#5E6420"); OnAccent = H("#FFFDF8");
        Matrix = H("#838A2D"); Hot = H("#C9782A"); Danger = H("#9A3528"); Track = H("#E3DDD0");
      }
    }
    static Color H(string s) { return ColorTranslator.FromHtml(s); }
    public static Color Mix(Color a, Color b, float t)
    {
      t = Math.Max(0f, Math.Min(1f, t));
      return Color.FromArgb(
        (int)(a.A + (b.A - a.A) * t), (int)(a.R + (b.R - a.R) * t),
        (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
    }
    public static float Scale = 1f;
    public static int S(float v) { return (int)Math.Round(v * Scale); }
    public static Font F(float px, bool bold)
    {
      return new Font("Microsoft YaHei UI", px * Scale, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel);
    }
    public static GraphicsPath Round(RectangleF r, float rad)
    {
      var p = new GraphicsPath();
      float d = Math.Min(rad * 2, Math.Min(r.Width, r.Height));
      if (d <= 0) { p.AddRectangle(r); return p; }
      p.AddArc(r.X, r.Y, d, d, 180, 90);
      p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
      p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
      p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
      p.CloseFigure();
      return p;
    }
  }

  // 循环动画:品牌 3×3 方阵扩成 5×5,正弦波纹从中心向外扩散;
  // Mode 0 = 待机(慢呼吸),1 = 工作中(快波纹 + 暖色高光),2 = 完成(收拢成品牌标志)
  class MatrixAnim : Control
  {
    public int Mode;
    float t, settle;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 33 };
    static readonly float[] Brand = { 1f, .6f, .35f, .6f, 1f, .6f, .35f, .6f, 1f };

    public MatrixAnim()
    {
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.SupportsTransparentBackColor, true);
      BackColor = Color.Transparent;
      timer.Tick += (s, e) =>
      {
        t += Mode == 1 ? 0.075f : 0.035f;
        settle = Mode == 2 ? Math.Min(1f, settle + 0.05f) : Math.Max(0f, settle - 0.05f);
        Invalidate();
      };
      // 系统"显示动画"关闭时(等同 prefers-reduced-motion)只画静态帧
      if (SystemInformation.UIEffectsEnabled) timer.Start();
    }

    protected override void Dispose(bool disposing) { if (disposing) timer.Dispose(); base.Dispose(disposing); }

    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.SmoothingMode = SmoothingMode.AntiAlias;
      const int N = 5;
      float pitch = Math.Min(Width, Height) / (float)N;
      float ox = (Width - pitch * N) / 2f, oy = (Height - pitch * N) / 2f;
      for (int y = 0; y < N; y++)
        for (int x = 0; x < N; x++)
        {
          float dx = x - 2, dy = y - 2;
          float dist = (float)Math.Sqrt(dx * dx + dy * dy);
          float wave = (float)(Math.Sin(t * 2.2 - dist * 1.15) * 0.5 + 0.5);
          float s = Mode == 1 ? 0.28f + 0.72f * wave : 0.42f + 0.4f * wave;
          float heat = Mode == 1 ? (float)Math.Pow(wave, 6) : 0f;
          // 完成态:外圈淡出,内 3×3 收拢到品牌标志的固定比例
          bool inner = Math.Abs(dx) <= 1 && Math.Abs(dy) <= 1;
          float target = inner ? Brand[(y - 1) * 3 + (x - 1)] : 0f;
          s = s + (target - s) * settle;
          heat *= 1 - settle;
          float alpha = inner ? 1f : 1f - settle;
          float w = pitch * 0.8f * s;
          if (w < 0.5f || alpha <= 0.01f) continue;
          var c = Theme.Mix(Theme.Matrix, Theme.Hot, heat);
          if (settle > 0 && inner) c = Theme.Mix(c, Theme.Accent, settle);
          c = Color.FromArgb((int)(255 * alpha * (0.55f + 0.45f * Math.Max(s, settle))), c);
          var r = new RectangleF(ox + x * pitch + (pitch - w) / 2, oy + y * pitch + (pitch - w) / 2, w, w);
          using (var b = new SolidBrush(c))
          using (var p = Theme.Round(r, w * 0.12f)) g.FillPath(b, p);
        }
    }
  }

  // 扁平按钮:主按钮苔绿底,次按钮描边;最小高度 44
  class FlatButton : Control, IButtonControl
  {
    public DialogResult DialogResult { get; set; }
    public void NotifyDefault(bool value) { }
    public void PerformClick() { if (Enabled && Visible) OnClick(EventArgs.Empty); }
    public bool Primary;
    bool hover, down;
    public FlatButton(string text, bool primary)
    {
      Text = text; Primary = primary;
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.Selectable | ControlStyles.StandardClick, true);
      Cursor = Cursors.Hand;
      TabStop = true;
      Font = Theme.F(14, true);
      Size = new Size(Theme.S(120), Theme.S(44));
      AccessibleRole = AccessibleRole.PushButton;
      AccessibleName = text;
    }
    protected override void OnTextChanged(EventArgs e) { AccessibleName = Text; Invalidate(); base.OnTextChanged(e); }
    protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = down = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { down = true; Focus(); Invalidate(); base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { down = false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }
    protected override bool IsInputKey(Keys k) { return k == Keys.Enter || k == Keys.Space || base.IsInputKey(k); }
    protected override void OnKeyUp(KeyEventArgs e) { if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) OnClick(EventArgs.Empty); base.OnKeyUp(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.SmoothingMode = SmoothingMode.AntiAlias;
      g.Clear(Parent != null ? Parent.BackColor : Theme.Bg);
      var r = new RectangleF(1, 1, Width - 3, Height - 3);
      Color fill, fg, border;
      if (Primary)
      {
        fill = Theme.Accent; fg = Theme.OnAccent; border = Theme.Accent;
        if (hover) fill = Theme.Mix(fill, Theme.Text, 0.12f);
        if (down) fill = Theme.Mix(fill, Theme.Text, 0.22f);
      }
      else
      {
        fill = Theme.Surface; fg = Theme.Text; border = Theme.Border;
        if (hover) fill = Theme.Mix(fill, Theme.Text, 0.05f);
        if (down) fill = Theme.Mix(fill, Theme.Text, 0.1f);
      }
      if (!Enabled) { fill = Theme.Mix(fill, Theme.Bg, 0.55f); fg = Theme.Mix(fg, Theme.Bg, 0.5f); }
      using (var p = Theme.Round(r, Theme.S(8)))
      {
        using (var b = new SolidBrush(fill)) g.FillPath(b, p);
        using (var pen = new Pen(border)) g.DrawPath(pen, p);
      }
      if (Focused && ShowFocusCues)
        using (var p = Theme.Round(new RectangleF(-0.5f + 3, 3, Width - 7, Height - 7), Theme.S(6)))
        using (var pen = new Pen(Primary ? Theme.OnAccent : Theme.Accent, 1.5f) { DashStyle = DashStyle.Dot }) g.DrawPath(pen, p);
      TextRenderer.DrawText(g, Text, Font, ClientRectangle, fg, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
    }
  }

  // 进度条:圆角轨道 + 苔绿填充,填充上有一道缓慢移动的高光(循环)
  class Progress : Control
  {
    float value, shown, shimmer;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 16 };
    public bool Indeterminate;
    public float Value { get { return value; } set { this.value = Math.Max(0, Math.Min(1, value)); } }
    public Progress()
    {
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
      Height = Theme.S(8);
      AccessibleRole = AccessibleRole.ProgressBar;
      timer.Tick += (s, e) =>
      {
        shown += (value - shown) * 0.18f;
        if (Math.Abs(value - shown) < 0.001f) shown = value;
        shimmer = (shimmer + 0.012f) % 1.6f;
        AccessibleDescription = ((int)(value * 100)) + "%";
        Invalidate();
      };
      timer.Start();
    }
    protected override void Dispose(bool disposing) { if (disposing) timer.Dispose(); base.Dispose(disposing); }
    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.SmoothingMode = SmoothingMode.AntiAlias;
      g.Clear(Parent != null ? Parent.BackColor : Theme.Bg);
      var track = new RectangleF(0, 0, Width - 1, Height - 1);
      using (var b = new SolidBrush(Theme.Track))
      using (var p = Theme.Round(track, Height / 2f)) g.FillPath(b, p);
      RectangleF fill;
      if (Indeterminate)
      {
        float w = Width * 0.3f;
        float x = (shimmer / 1.6f) * (Width + w) - w;
        fill = RectangleF.Intersect(track, new RectangleF(x, 0, w, Height - 1));
      }
      else fill = new RectangleF(0, 0, Math.Max(Height, (Width - 1) * shown), Height - 1);
      if (fill.Width <= 0 || (!Indeterminate && shown <= 0.001f)) return;
      using (var p = Theme.Round(fill, Height / 2f))
      {
        using (var b = new SolidBrush(Theme.Accent)) g.FillPath(b, p);
        if (!Indeterminate && SystemInformation.UIEffectsEnabled)
        {
          float sx = shimmer * Width - Width * 0.3f;
          var band = new RectangleF(sx, 0, Width * 0.3f, Height);
          using (var lb = new LinearGradientBrush(band, Color.Transparent, Color.Transparent, 0f))
          {
            var cb = new ColorBlend(3);
            cb.Colors = new[] { Color.FromArgb(0, 255, 255, 255), Color.FromArgb(70, 255, 255, 255), Color.FromArgb(0, 255, 255, 255) };
            cb.Positions = new[] { 0f, 0.5f, 1f };
            lb.InterpolationColors = cb;
            var old = g.Clip; g.SetClip(p);
            g.FillRectangle(lb, band);
            g.Clip = old;
          }
        }
      }
    }
  }

  // 复选框:自绘 20px 方框 + 文字,整行可点(高度 ≥ 32,行间距补足触控面积)
  class Check : Control
  {
    bool on;
    public event EventHandler Changed;
    public bool Checked { get { return on; } set { on = value; AccessibleDescription = on ? "已选中" : "未选中"; Invalidate(); } }
    public Check(string text, bool value)
    {
      Text = text; AccessibleName = text; AccessibleRole = AccessibleRole.CheckButton;
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.Selectable | ControlStyles.StandardClick, true);
      TabStop = true; Cursor = Cursors.Hand; Font = Theme.F(14, false);
      Height = Theme.S(32);
      Checked = value;
    }
    void Toggle() { Checked = !on; if (Changed != null) Changed(this, EventArgs.Empty); }
    protected override void OnClick(EventArgs e) { Focus(); Toggle(); base.OnClick(e); }
    protected override bool IsInputKey(Keys k) { return k == Keys.Space || base.IsInputKey(k); }
    protected override void OnKeyUp(KeyEventArgs e) { if (e.KeyCode == Keys.Space) Toggle(); base.OnKeyUp(e); }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.SmoothingMode = SmoothingMode.AntiAlias;
      g.Clear(Parent != null ? Parent.BackColor : Theme.Bg);
      int box = Theme.S(20);
      var r = new RectangleF(1, (Height - box) / 2f, box - 2, box - 2);
      using (var p = Theme.Round(r, Theme.S(5)))
      {
        using (var b = new SolidBrush(on ? Theme.Accent : Theme.Surface)) g.FillPath(b, p);
        using (var pen = new Pen(on ? Theme.Accent : Theme.Text3, 1.2f)) g.DrawPath(pen, p);
      }
      if (on)
        using (var pen = new Pen(Theme.OnAccent, Theme.S(2)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
          g.DrawLines(pen, new[] {
            new PointF(r.X + r.Width * .24f, r.Y + r.Height * .52f),
            new PointF(r.X + r.Width * .43f, r.Y + r.Height * .7f),
            new PointF(r.X + r.Width * .77f, r.Y + r.Height * .32f) });
      var tr = new Rectangle(box + Theme.S(8), 0, Width - box - Theme.S(8), Height);
      TextRenderer.DrawText(g, Text, Font, tr, Theme.Text, TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
      if (Focused && ShowFocusCues)
        using (var pen = new Pen(Theme.Accent, 1.5f) { DashStyle = DashStyle.Dot })
          g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
    }
  }

  // 路径输入框:原生 TextBox 无法设高度,外面包一层 44px 的描边面板
  class PathBox : Panel
  {
    public readonly TextBox Box = new TextBox();
    public PathBox()
    {
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
      Height = Theme.S(44);
      BackColor = Theme.Surface;
      Box.BorderStyle = BorderStyle.None;
      Box.BackColor = Theme.Surface;
      Box.ForeColor = Theme.Text;
      Box.Font = Theme.F(14, false);
      Box.AccessibleName = "安装位置";
      Box.GotFocus += (s, e) => Invalidate();
      Box.LostFocus += (s, e) => Invalidate();
      Controls.Add(Box);
    }
    protected override void OnLayout(LayoutEventArgs e)
    {
      base.OnLayout(e);
      Box.SetBounds(Theme.S(12), (Height - Box.PreferredHeight) / 2, Width - Theme.S(24), Box.PreferredHeight);
    }
    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.SmoothingMode = SmoothingMode.AntiAlias;
      g.Clear(Parent != null ? Parent.BackColor : Theme.Bg);
      using (var p = Theme.Round(new RectangleF(0.5f, 0.5f, Width - 2, Height - 2), Theme.S(8)))
      {
        using (var b = new SolidBrush(Theme.Surface)) g.FillPath(b, p);
        using (var pen = new Pen(Box.Focused ? Theme.Accent : Theme.Border, Box.Focused ? 2f : 1f)) g.DrawPath(pen, p);
      }
    }
  }

  static class Util
  {
    public static string Bytes(double b)
    {
      if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).ToString("0.00") + " GB";
      if (b >= 1024 * 1024) return (b / 1024 / 1024).ToString("0.0") + " MB";
      if (b >= 1024) return (b / 1024).ToString("0") + " KB";
      return b.ToString("0") + " B";
    }
    public static string Eta(double sec)
    {
      if (double.IsNaN(sec) || double.IsInfinity(sec) || sec < 0) return "估算中";
      if (sec < 60) return "约 " + Math.Max(1, (int)Math.Ceiling(sec)) + " 秒";
      if (sec < 3600) return "约 " + (int)Math.Ceiling(sec / 60) + " 分钟";
      return "约 " + (sec / 3600).ToString("0.0") + " 小时";
    }
    // 只取 latest.json 里我们需要的几个字段,避免引入 JSON 库
    public static string Json(string json, string key)
    {
      var m = Regex.Match(json, "\"" + Regex.Escape(key) + "\"\\s*:\\s*(\"((?:[^\"\\\\]|\\\\.)*)\"|(-?\\d+))");
      if (!m.Success) return null;
      return m.Groups[2].Success && m.Groups[1].Value.StartsWith("\"") ? Regex.Unescape(m.Groups[2].Value) : m.Groups[3].Value;
    }
    public static string Hex(byte[] b)
    {
      var sb = new StringBuilder(b.Length * 2);
      foreach (var x in b) sb.Append(x.ToString("x2"));
      return sb.ToString();
    }
    // 通过 WScript.Shell 创建 .lnk(反射调用 COM,免去对 Microsoft.CSharp 的依赖)
    public static void Shortcut(string lnk, string target, string workDir, string desc)
    {
      var t = Type.GetTypeFromProgID("WScript.Shell");
      object shell = Activator.CreateInstance(t);
      try
      {
        object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
        var st = sc.GetType();
        st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
        st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { workDir });
        st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { desc });
        st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { target + ",0" });
        st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
        Marshal.FinalReleaseComObject(sc);
      }
      finally { Marshal.FinalReleaseComObject(shell); }
    }
    // 进程退出后由 cmd 延迟执行清理(运行中的 exe 无法删除自己)
    public static void AfterExit(string commands)
    {
      var psi = new ProcessStartInfo("cmd.exe", "/d /c ping 127.0.0.1 -n 3 >nul & " + commands)
      {
        CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden,
        WorkingDirectory = Path.GetTempPath(),
      };
      Process.Start(psi);
    }
    public static bool IsAppRunning()
    {
      try { return Process.GetProcessesByName("ChronoKey").Length > 0; } catch { return false; }
    }
  }

  static class Paths
  {
    public const string AppName = "ChronoKey";
    public const string Publisher = "JiuYue0820";
    public const string DefaultSource = "https://github.com/JiuYue0820/ChronoKey/releases/latest/download/";
    public const string Homepage = "https://jiuyue0820.github.io/ChronoKey/";
    public const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ChronoKey";
    public static string DefaultDir { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName); } }
    public static string DesktopLnk { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"); } }
    public static string StartLnk { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"); } }
    // Electron userData(app.setName('ChronoKey')),保险库在其中的 vault 子目录
    public static string UserData { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), AppName); } }
  }

  // 页面:子控件按加入顺序纵向排列;页脚按钮靠右下。命中测试透传给窗体,空白处可拖动窗口
  class Page : Panel
  {
    readonly List<KeyValuePair<Control, int>> flow = new List<KeyValuePair<Control, int>>();
    readonly List<FlatButton> foot = new List<FlatButton>();
    public Page() { BackColor = Theme.Bg; Visible = false; }
    public T Add<T>(T c, int gap) where T : Control
    {
      flow.Add(new KeyValuePair<Control, int>(c, Theme.S(gap)));
      Controls.Add(c);
      return c;
    }
    public FlatButton Foot(FlatButton b) { foot.Add(b); Controls.Add(b); return b; }
    public FlatButton Primary { get { return foot.Count > 0 ? foot[foot.Count - 1] : null; } }
    protected override void OnLayout(LayoutEventArgs e)
    {
      base.OnLayout(e);
      int y = 0;
      foreach (var kv in flow)
      {
        var c = kv.Key;
        if (!c.Visible) continue;
        y += kv.Value;
        var l = c as Label;
        if (l != null) l.MaximumSize = new Size(Width, 0);
        else if (!(c is FlatButton)) c.Width = Width;
        c.Location = new Point(0, y);
        y += c.Height;
      }
      int x = Width;
      for (int i = foot.Count - 1; i >= 0; i--)
      {
        if (!foot[i].Visible) continue;
        x -= foot[i].Width;
        foot[i].Location = new Point(x, Height - foot[i].Height);
        x -= Theme.S(8);
      }
    }
    protected override void WndProc(ref Message m)
    {
      base.WndProc(ref m);
      if (m.Msg == 0x84) m.Result = (IntPtr)(-1); // WM_NCHITTEST → HTTRANSPARENT
    }
  }

  // 一行左右两段文字(进度条下方的"已下载 / 速度 · 剩余时间")
  class Row : Control
  {
    public readonly Label L = new Label(), R = new Label();
    public Row()
    {
      Height = Theme.S(24);
      foreach (var l in new[] { L, R })
      {
        l.AutoSize = true; l.Font = Theme.F(14, false); l.ForeColor = Theme.Text2; l.BackColor = Theme.Bg;
        Controls.Add(l);
      }
      L.TextChanged += (s, e) => PerformLayout();
      R.TextChanged += (s, e) => PerformLayout();
    }
    protected override void OnLayout(LayoutEventArgs e)
    {
      base.OnLayout(e);
      L.Location = new Point(0, (Height - L.Height) / 2);
      R.Location = new Point(Width - R.Width, (Height - R.Height) / 2);
    }
  }

  // 左侧栏:循环方阵 + 品牌 + 步骤指示
  class SidePanel : Control
  {
    public readonly MatrixAnim Anim = new MatrixAnim();
    public string[] Steps = new string[0];
    public int Current;
    public string Version = "";
    public SidePanel()
    {
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
      BackColor = Theme.Side;
      Anim.Size = new Size(Theme.S(112), Theme.S(112));
      Controls.Add(Anim);
    }
    protected override void OnLayout(LayoutEventArgs e)
    {
      base.OnLayout(e);
      Anim.Location = new Point(Theme.S(32), Theme.S(56));
    }
    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      g.Clear(Theme.Side);
      int x = Theme.S(32), y = Theme.S(56) + Anim.Height + Theme.S(24);
      using (var f = Theme.F(24, true)) TextRenderer.DrawText(g, "ChronoKey", f, new Point(x - Theme.S(2), y), Theme.Text);
      y += Theme.S(36);
      using (var f = Theme.F(14, false)) TextRenderer.DrawText(g, "离线密码库 · 数据只在本机", f, new Point(x, y), Theme.Text2);
      y += Theme.S(48);
      using (var f = Theme.F(14, false))
      using (var fb = Theme.F(14, true))
        for (int i = 0; i < Steps.Length; i++)
        {
          bool done = i < Current, cur = i == Current;
          var dot = new Rectangle(x, y + Theme.S(4), Theme.S(16), Theme.S(16));
          g.SmoothingMode = SmoothingMode.AntiAlias;
          if (done || cur) using (var b = new SolidBrush(done ? Theme.Accent : Theme.Surface)) g.FillEllipse(b, dot);
          using (var pen = new Pen(done || cur ? Theme.Accent : Theme.Text3, 1.5f)) g.DrawEllipse(pen, dot);
          if (done)
            using (var pen = new Pen(Theme.OnAccent, Theme.S(1.6f)) { StartCap = LineCap.Round, EndCap = LineCap.Round })
              g.DrawLines(pen, new[] { new PointF(dot.X + dot.Width * .28f, dot.Y + dot.Height * .52f), new PointF(dot.X + dot.Width * .45f, dot.Y + dot.Height * .68f), new PointF(dot.X + dot.Width * .74f, dot.Y + dot.Height * .34f) });
          else if (cur) using (var b = new SolidBrush(Theme.Accent)) g.FillEllipse(b, dot.X + Theme.S(5), dot.Y + Theme.S(5), dot.Width - Theme.S(10), dot.Height - Theme.S(10));
          TextRenderer.DrawText(g, Steps[i], cur ? fb : f, new Point(x + Theme.S(28), y + Theme.S(2)), cur || done ? Theme.Text : Theme.Text2);
          y += Theme.S(40);
        }
      using (var f = Theme.F(14, false)) TextRenderer.DrawText(g, Version, f, new Point(x, Height - Theme.S(40)), Theme.Text3);
    }
    protected override void WndProc(ref Message m)
    {
      base.WndProc(ref m);
      if (m.Msg == 0x84) m.Result = (IntPtr)(-1);
    }
  }

  // 标题栏按钮(最小化 / 关闭),46×32 与 Windows 原生一致
  class CaptionButton : Control
  {
    readonly bool close; bool hover;
    public CaptionButton(bool isClose)
    {
      close = isClose;
      SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
      Size = new Size(Theme.S(46), Theme.S(32));
      AccessibleRole = AccessibleRole.PushButton;
      AccessibleName = close ? "关闭" : "最小化";
      TabStop = false;
    }
    protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
      var g = e.Graphics;
      var bg = hover ? (close ? Color.FromArgb(196, 43, 28) : Theme.Mix(Theme.Bg, Theme.Text, 0.08f)) : Theme.Bg;
      g.Clear(bg);
      g.SmoothingMode = SmoothingMode.AntiAlias;
      float cx = Width / 2f, cy = Height / 2f, r = Theme.S(5);
      using (var pen = new Pen(hover && close ? Color.White : Theme.Text, Math.Max(1f, Theme.Scale)))
        if (close) { g.DrawLine(pen, cx - r, cy - r, cx + r, cy + r); g.DrawLine(pen, cx + r, cy - r, cx - r, cy + r); }
        else g.DrawLine(pen, cx - r, cy, cx + r, cy);
    }
  }

  class PathRow : Panel
  {
    public readonly PathBox Input = new PathBox();
    public readonly FlatButton Browse = new FlatButton("浏览…", false);
    public PathRow()
    {
      BackColor = Theme.Bg; Height = Theme.S(44);
      Browse.Width = Theme.S(96);
      Controls.Add(Input); Controls.Add(Browse);
    }
    protected override void OnLayout(LayoutEventArgs e)
    {
      base.OnLayout(e);
      Browse.Location = new Point(Width - Browse.Width, 0);
      Input.SetBounds(0, 0, Width - Browse.Width - Theme.S(8), Height);
    }
  }

  // 文字标签:自动换行,命中测试透传(窗体空白处可拖动)
  class Txt : Label
  {
    public Txt(string text, float px, bool bold, Color color)
    {
      Text = text; AutoSize = true; Font = Theme.F(px, bold); ForeColor = color; BackColor = Theme.Bg;
      UseMnemonic = false;
    }
    protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); if (Parent != null) Parent.PerformLayout(); }
    protected override void WndProc(ref Message m)
    {
      base.WndProc(ref m);
      if (m.Msg == 0x84) m.Result = (IntPtr)(-1);
    }
  }

  class CancelledException : Exception { }

  class SetupForm : Form
  {
    public static string DirOverride;
    public static bool Auto;
    public static string LangOverride; // /lang:<code>:自动化测试用,强制选择应用语言
    readonly bool uninstall;
    readonly string source;
    readonly SidePanel side = new SidePanel();
    readonly CaptionButton btnMin = new CaptionButton(false), btnClose = new CaptionButton(true);
    readonly Rectangle content;
    Page current;
    volatile bool cancel;
    bool busy, cancellable, finished;
    string installDir;
    string tempDir = Path.Combine(Path.GetTempPath(), "ChronoKey-setup");

    // 安装页面
    Page pLocation, pWork, pDone, pError;
    PathRow pathRow;
    Check chkDesktop, chkStart, chkLaunch, chkKeep;
    Txt workTitle, workStatus, workDetail, doneBody, errBody, keepHint, locHint;
    Progress bar;
    Row stats;
    // 语言选择:应用界面语言。zh/en/ru 内置,其余语言在安装时从 Releases 一起下载语言包
    ComboBox langBox;
    string langManifest;   // languages.json 原文;null 表示清单没拿到(只提供内置语言)
    readonly List<LangOpt> langOpts = new List<LangOpt>();

    class LangOpt { public string Code, Label; public bool Builtin; }

    // languages.json 里单个语言条目(键序固定:code,label,file,sha256)
    static readonly Regex LangEntry = new Regex(
      @"\{\s*""code""\s*:\s*""(?<code>[a-z]{2,3}(?:-[A-Za-z]{2,4})?)""\s*,\s*""label""\s*:\s*""(?<label>(?:[^""\\]|\\.)*)""\s*,\s*""file""\s*:\s*""(?<file>[^""/\\]+)""\s*,\s*""sha256""\s*:\s*""(?<sha>[0-9a-fA-F]{64})""\s*\}",
      RegexOptions.Compiled);

    public SetupForm(bool uninstall, string source)
    {
      this.uninstall = uninstall;
      this.source = string.IsNullOrEmpty(source) ? Paths.DefaultSource : source;
      using (var g = CreateGraphics()) Theme.Scale = Math.Max(1f, g.DpiX / 96f);
      Theme.Init();

      FormBorderStyle = FormBorderStyle.None;
      StartPosition = FormStartPosition.Manual; // 在 OnLoad 中按鼠标所在屏幕的工作区居中
      ClientSize = new Size(Theme.S(760), Theme.S(480));
      BackColor = Theme.Bg;
      Text = uninstall ? "卸载 ChronoKey" : "安装 ChronoKey";
      DoubleBuffered = true;
      KeyPreview = true;
      try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

      side.Bounds = new Rectangle(0, 0, Theme.S(240), ClientSize.Height);
      side.Steps = uninstall ? new[] { "确认", "卸载", "完成" } : new[] { "选择位置", "下载", "安装", "完成" };
      side.Version = uninstall ? "卸载程序" : "安装程序 v" + Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
      Controls.Add(side);

      btnClose.Location = new Point(ClientSize.Width - btnClose.Width, 0);
      btnMin.Location = new Point(btnClose.Left - btnMin.Width, 0);
      btnClose.Click += (s, e) => Close();
      btnMin.Click += (s, e) => WindowState = FormWindowState.Minimized;
      Controls.Add(btnClose); Controls.Add(btnMin);

      content = new Rectangle(side.Width + Theme.S(48), Theme.S(56), ClientSize.Width - side.Width - Theme.S(96), ClientSize.Height - Theme.S(56) - Theme.S(40));

      if (uninstall) BuildUninstall(); else BuildInstall();
      BuildCommon();
      Show(uninstall ? pLocation : pLocation);
      KeyDown += (s, e) => { if (e.KeyCode == Keys.Escape && !busy) Close(); };
    }

    static void AutoLog(string line)
    {
      try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "ck-setup-auto.log"), DateTime.Now.ToString("HH:mm:ss ") + line + Environment.NewLine); } catch { }
    }

    Page NewPage()
    {
      var p = new Page { Bounds = content };
      Controls.Add(p);
      return p;
    }

    void Show(Page p)
    {
      if (current != null) current.Visible = false;
      current = p;
      p.Visible = true;
      p.PerformLayout();
      AcceptButton = p.Primary;
      // 测试用 /auto:自动点击每页的主按钮;出错时把原因写入 %TEMP%\ck-setup-auto.log 并退出
      if (Auto) AutoLog("page: " + (p == pLocation ? "location" : p == pWork ? "work" : p == pDone ? "done" : "error") + " dir=" + installDir);
      if (Auto && p != pWork)
      {
        var tm = new System.Windows.Forms.Timer { Interval = 1500 };
        tm.Tick += (s, e) =>
        {
          tm.Dispose();
          if (current != p) return;
          if (p == pError) { AutoLog("error: " + errBody.Text); Close(); }
          else p.Primary.PerformClick();
        };
        tm.Start();
      }
      if (p.Primary != null) p.Primary.Focus();
      side.Current = p == pLocation ? 0 : p == pDone ? side.Steps.Length - 1 : p == pError ? side.Current : side.Current;
      side.Invalidate();
    }

    void Step(int i) { side.Current = i; side.Invalidate(); }

    // ---------- 安装界面 ----------
    void BuildInstall()
    {
      pLocation = NewPage();
      pLocation.Add(new Txt("选择安装位置", 32, true, Theme.Text), 0);
      locHint = pLocation.Add(new Txt("ChronoKey 将安装到下面的文件夹。安装到当前用户目录,无需管理员权限。", 16, false, Theme.Text2), 8);
      pathRow = pLocation.Add(new PathRow(), 24);
      installDir = DirOverride ?? ReadInstalledDir() ?? Paths.DefaultDir;
      pathRow.Input.Box.Text = installDir;
      pathRow.Browse.Click += (s, e) =>
      {
        using (var d = new FolderBrowserDialog { Description = "选择 ChronoKey 的安装位置", ShowNewFolderButton = true })
        {
          try { d.SelectedPath = Directory.Exists(pathRow.Input.Box.Text) ? pathRow.Input.Box.Text : Path.GetDirectoryName(pathRow.Input.Box.Text); } catch { }
          if (d.ShowDialog(this) == DialogResult.OK)
            pathRow.Input.Box.Text = d.SelectedPath.TrimEnd('\\').EndsWith(Paths.AppName, StringComparison.OrdinalIgnoreCase)
              ? d.SelectedPath : Path.Combine(d.SelectedPath, Paths.AppName);
        }
      };
      pLocation.Add(new Txt("需要约 400 MB 可用空间,下载约 140 MB。", 14, false, Theme.Text3), 8);
      chkDesktop = pLocation.Add(new Check("创建桌面快捷方式", true), 16);
      chkStart = pLocation.Add(new Check("添加到开始菜单", true), 4);
      pLocation.Add(new Txt("应用界面语言 (App language)", 14, true, Theme.Text2), 24);
      langBox = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, FlatStyle = FlatStyle.Flat, Font = Theme.F(14, false) };
      pLocation.Add(langBox, 6);
      pLocation.Add(new Txt("内置:简体中文 · English · Русский。选择其他语言会在安装时从 GitHub 自动下载。\nBuilt-in: Chinese · English · Russian. Other languages are downloaded automatically during install.", 12, false, Theme.Text3), 6);
      InitLangList();
      // 自动化测试(/auto):不建快捷方式、不启动应用,只验证安装流程本身
      if (Auto) { chkDesktop.Checked = false; chkStart.Checked = false; }
      pLocation.Foot(new FlatButton("取消", false)).Click += (s, e) => Close();
      pLocation.Foot(new FlatButton("开始安装", true)).Click += (s, e) => StartInstall();

      pWork = NewPage();
      workTitle = pWork.Add(new Txt("正在下载", 32, true, Theme.Text), 0);
      workStatus = pWork.Add(new Txt("正在连接 GitHub…", 16, false, Theme.Text2), 8);
      bar = pWork.Add(new Progress(), 40);
      stats = pWork.Add(new Row(), 8);
      workDetail = pWork.Add(new Txt("", 14, false, Theme.Text3), 16);
      pWork.Foot(new FlatButton("取消", false)).Click += (s, e) => AskCancel();

      pDone = NewPage();
      pDone.Add(new Txt("安装完成", 32, true, Theme.Text), 0);
      doneBody = pDone.Add(new Txt("", 16, false, Theme.Text2), 8);
      chkLaunch = pDone.Add(new Check("立即启动 ChronoKey", !Auto), 24);
      pDone.Add(new Txt("关闭后安装程序会自动删除自身。之后可在\"设置 → 应用 → 已安装的应用\"中卸载。", 14, false, Theme.Text3), 16);
      pDone.Foot(new FlatButton("完成", true)).Click += (s, e) => { Close(); };
    }

    // ---------- 卸载界面 ----------
    void BuildUninstall()
    {
      string here = Path.GetDirectoryName(Path.GetFullPath(Application.ExecutablePath));
      installDir = File.Exists(Path.Combine(here, "ChronoKey.exe")) ? here : ReadInstalledDir() ?? here;
      pLocation = NewPage();
      pLocation.Add(new Txt("卸载 ChronoKey", 32, true, Theme.Text), 0);
      locHint = pLocation.Add(new Txt("将删除程序文件、快捷方式和卸载项:\n" + installDir, 16, false, Theme.Text2), 8);
      chkKeep = pLocation.Add(new Check("保留我的保险库数据(推荐)", true), 24);
      keepHint = pLocation.Add(new Txt("保险库与自动快照位于 " + Paths.UserData + "。保留后重新安装即可继续使用;取消勾选将永久删除,无法恢复。", 14, false, Theme.Text3), 4);
      chkKeep.Changed += (s, e) => keepHint.ForeColor = chkKeep.Checked ? Theme.Text3 : Theme.Danger;
      pLocation.Foot(new FlatButton("取消", false)).Click += (s, e) => Close();
      pLocation.Foot(new FlatButton("卸载", true)).Click += (s, e) => StartUninstall();

      pWork = NewPage();
      workTitle = pWork.Add(new Txt("正在卸载", 32, true, Theme.Text), 0);
      workStatus = pWork.Add(new Txt("", 16, false, Theme.Text2), 8);
      bar = pWork.Add(new Progress(), 40);
      stats = pWork.Add(new Row(), 8);
      workDetail = pWork.Add(new Txt("", 14, false, Theme.Text3), 16);

      pDone = NewPage();
      pDone.Add(new Txt("已卸载", 32, true, Theme.Text), 0);
      doneBody = pDone.Add(new Txt("", 16, false, Theme.Text2), 8);
      pDone.Foot(new FlatButton("完成", true)).Click += (s, e) => Close();
    }

    void BuildCommon()
    {
      pError = NewPage();
      pError.Add(new Txt("没能完成", 32, true, Theme.Text), 0);
      errBody = pError.Add(new Txt("", 16, false, Theme.Text2), 8);
      pError.Add(new Txt("没有改动你的保险库数据。", 14, false, Theme.Text3), 16);
      pError.Foot(new FlatButton("关闭", false)).Click += (s, e) => Close();
      pError.Foot(new FlatButton("重试", true)).Click += (s, e) => { Step(0); Show(pLocation); };
    }

    static string ReadInstalledDir()
    {
      try
      {
        using (var k = Registry.CurrentUser.OpenSubKey(Paths.UninstallKey))
        {
          var v = k == null ? null : k.GetValue("InstallLocation") as string;
          return string.IsNullOrEmpty(v) ? null : v;
        }
      }
      catch { return null; }
    }

    // 工作线程 → 界面
    void Ui(Action a)
    {
      if (IsDisposed) return;
      try { BeginInvoke(a); } catch (InvalidOperationException) { }
    }
    void Status(string title, string status)
    {
      Ui(() => { if (title != null) workTitle.Text = title; if (status != null) workStatus.Text = status; });
    }
    void Fail(Exception ex)
    {
      Ui(() =>
      {
        busy = false;
        side.Anim.Mode = 0;
        errBody.Text = ex is CancelledException ? "已取消。" : ex.Message;
        Show(pError);
      });
    }

    void AskCancel()
    {
      if (!busy) { Close(); return; }
      if (!cancellable) return;
      var r = MessageBox.Show(this, "确定要取消安装吗?已下载的内容会被删除。", "取消安装", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2);
      if (r == DialogResult.Yes) { cancel = true; workStatus.Text = "正在取消…"; }
    }

    // 拒绝明显危险的位置:卸载时会删除整个文件夹
    static string ValidateDir(string dir)
    {
      if (string.IsNullOrWhiteSpace(dir)) return "请选择安装位置。";
      try { dir = Path.GetFullPath(dir.Trim()); } catch { return "路径无效。"; }
      if (!Path.IsPathRooted(dir) || dir.StartsWith(@"\\")) return "请选择本机磁盘上的文件夹。";
      var trimmed = dir.TrimEnd('\\');
      if (trimmed.Length <= 2 || Path.GetPathRoot(dir).TrimEnd('\\').Equals(trimmed, StringComparison.OrdinalIgnoreCase)) return "不能直接安装到磁盘根目录。";
      var forbidden = new[] {
        Environment.SpecialFolder.UserProfile, Environment.SpecialFolder.DesktopDirectory, Environment.SpecialFolder.MyDocuments,
        Environment.SpecialFolder.Windows, Environment.SpecialFolder.System, Environment.SpecialFolder.ProgramFiles,
        Environment.SpecialFolder.ProgramFilesX86, Environment.SpecialFolder.LocalApplicationData, Environment.SpecialFolder.ApplicationData,
      };
      foreach (var f in forbidden)
      {
        var p = Environment.GetFolderPath(f);
        if (!string.IsNullOrEmpty(p) && p.TrimEnd('\\').Equals(trimmed, StringComparison.OrdinalIgnoreCase)) return "这是系统文件夹,请在其中新建一个 ChronoKey 子文件夹。";
      }
      if (trimmed.Equals(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs"), StringComparison.OrdinalIgnoreCase))
        return "请在 Programs 中新建一个 ChronoKey 子文件夹。";
      if (Directory.Exists(dir) && Directory.EnumerateFileSystemEntries(dir).Any() && !File.Exists(Path.Combine(dir, "ChronoKey.exe")))
        return "这个文件夹不是空的。为避免卸载时误删其他文件,请选择空文件夹或新文件夹。";
      return null;
    }

    // ---------- 应用界面语言 ----------
    void InitLangList()
    {
      langOpts.Add(new LangOpt { Code = "zh", Label = "简体中文", Builtin = true });
      langOpts.Add(new LangOpt { Code = "en", Label = "English", Builtin = true });
      langOpts.Add(new LangOpt { Code = "ru", Label = "Русский", Builtin = true });
      // 按系统界面语言预选(zh-CN → zh,de-AT → de)
      string ui = "";
      try { ui = System.Globalization.CultureInfo.CurrentUICulture.Name; } catch { }
      string baseCode = ui.Length > 0 ? ui.Split('-')[0].ToLowerInvariant() : "";
      int def = langOpts.FindIndex(o => o.Code == baseCode);
      foreach (var o in langOpts) langBox.Items.Add(o.Label);
      langBox.SelectedIndex = def >= 0 ? def : 0;

      // 后台拉取语言清单(languages.json 与 latest.json 同源);失败只影响可选语言数量,不阻塞安装
      if (IsLocalSource)
      {
        try
        {
          long _;
          using (var s = Open("languages.json", out _))
          using (var r = new StreamReader(s, Encoding.UTF8)) langManifest = r.ReadToEnd();
          ParseLangManifest(langManifest);
          RepopulateLangList();
        }
        catch { }
        return;
      }
      new Thread(() =>
      {
        try
        {
          ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | (SecurityProtocolType)12288; // TLS 1.2 / 1.3
          long _;
          using (var s = Open("languages.json", out _))
          using (var r = new StreamReader(s, Encoding.UTF8)) langManifest = r.ReadToEnd();
          if (!string.IsNullOrEmpty(langManifest) && langManifest.IndexOf("\"languages\"") >= 0)
          {
            ParseLangManifest(langManifest);
            Ui(() => RepopulateLangList());
          }
        }
        catch { /* 清单拿不到就只列内置语言 */ }
      }) { IsBackground = true }.Start();
    }

    void ParseLangManifest(string json)
    {
      if (string.IsNullOrEmpty(json)) return;
      foreach (Match m in LangEntry.Matches(json))
      {
        string code = m.Groups["code"].Value;
        if (code == "zh" || code == "en" || code == "ru") continue;
        if (langOpts.Any(o => o.Code == code)) continue;
        string label = m.Groups["label"].Value;
        try { label = Regex.Unescape(label); } catch { }
        langOpts.Add(new LangOpt { Code = code, Label = string.IsNullOrEmpty(label) ? code : label, Builtin = false });
      }
    }

    void RepopulateLangList()
    {
      if (langBox == null || langBox.IsDisposed) return;
      string sel = SelectedLangCode();
      langBox.Items.Clear();
      foreach (var o in langOpts) langBox.Items.Add(o.Label);
      int idx = langOpts.FindIndex(o => o.Code == sel);
      langBox.SelectedIndex = idx >= 0 ? idx : 0;
    }

    string SelectedLangCode()
    {
      // /lang: 覆盖(自动化测试),合法性由 WriteLangPack 再次校验
      if (!string.IsNullOrEmpty(LangOverride) && Regex.IsMatch(LangOverride, "^[a-z]{2,3}(-[A-Za-z]{2,4})?$")) return LangOverride;
      if (langBox == null || langBox.SelectedIndex < 0 || langBox.SelectedIndex >= langOpts.Count) return "zh";
      return langOpts[langBox.SelectedIndex].Code;
    }

    // 选择内置三种之外的语言时,把对应语言包装进 <安装目录>\locales\<code>.json。
    // 任何失败都只跳过语言包(应用仍有 zh/en/ru),不影响安装本身。
    void WriteLangPack(string code)
    {
      if (code == "zh" || code == "en" || code == "ru") return;
      if (!Regex.IsMatch(code, "^[a-z]{2,3}(-[A-Za-z]{2,4})?$")) return;
      string manifest = langManifest;
      if (string.IsNullOrEmpty(manifest))
      {
        try
        {
          long _;
          using (var s = Open("languages.json", out _))
          using (var r = new StreamReader(s, Encoding.UTF8)) manifest = r.ReadToEnd();
        }
        catch { return; }
      }
      var m = LangEntry.Matches(manifest ?? "").Cast<Match>().FirstOrDefault(x => x.Groups["code"].Value == code);
      if (m == null) return;
      string file = m.Groups["file"].Value, sha = m.Groups["sha"].Value;
      if (file.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return;

      Status(null, "正在下载语言包 (" + code + ")…");
      string packPath = Path.Combine(tempDir, code + ".pack");
      DownloadSingle(file, packPath, 0);
      string actual;
      using (var h = SHA256.Create())
      using (var fs = File.OpenRead(packPath)) actual = Util.Hex(h.ComputeHash(fs));
      if (!actual.Equals(sha.Trim(), StringComparison.OrdinalIgnoreCase)) return; // 校验失败跳过
      string content = File.ReadAllText(packPath, Encoding.UTF8);
      if (content.IndexOf("\"dict\"") < 0) return; // 不是语言包格式
      string dir = Path.Combine(installDir, "locales");
      Directory.CreateDirectory(dir);
      Retry(() => File.Copy(packPath, Path.Combine(dir, code + ".json"), true));
    }

    void StartInstall()
    {
      var err = ValidateDir(pathRow.Input.Box.Text);
      if (err != null) { MessageBox.Show(this, err, "安装位置", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
      if (!Auto && Util.IsAppRunning()) { MessageBox.Show(this, "ChronoKey 正在运行。请先退出(保存好未完成的编辑),再继续安装。", "需要退出 ChronoKey", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
      installDir = Path.GetFullPath(pathRow.Input.Box.Text.Trim()).TrimEnd('\\');
      cancel = false; busy = true; cancellable = true;
      bar.Value = 0; bar.Indeterminate = true;
      stats.L.Text = ""; stats.R.Text = ""; workDetail.Text = "";
      workTitle.Text = "正在下载"; workStatus.Text = "正在获取最新版本信息…";
      pWork.Primary.Enabled = true;
      Step(1); Show(pWork);
      side.Anim.Mode = 1;
      bool desktop = chkDesktop.Checked, start = chkStart.Checked;
      string langCode = SelectedLangCode();
      new Thread(() =>
      {
        try { DoInstall(desktop, start, langCode); }
        catch (Exception ex) { Fail(ex); }
      }) { IsBackground = true }.Start();
    }

    bool IsLocalSource { get { return !source.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !source.StartsWith("https://", StringComparison.OrdinalIgnoreCase); } }

    Stream Open(string name, out long length)
    {
      if (IsLocalSource)
      {
        var fs = File.OpenRead(Path.Combine(source, name));
        length = fs.Length;
        return fs;
      }
      HttpWebResponse resp;
      try { resp = (HttpWebResponse)Request(source.TrimEnd('/') + "/" + name).GetResponse(); }
      catch (WebException ex) { throw ConnectError(ex, name); }
      length = resp.ContentLength;
      return resp.GetResponseStream();
    }

    static HttpWebRequest Request(string url)
    {
      var req = (HttpWebRequest)WebRequest.Create(url);
      req.UserAgent = "ChronoKeySetup/" + Assembly.GetExecutingAssembly().GetName().Version.ToString(3);
      req.AllowAutoRedirect = true; // GitHub 会重定向到带签名的下载地址,Range 头随重定向保留
      req.Timeout = 30000;
      req.ReadWriteTimeout = 20000;
      return req;
    }

    static Exception ConnectError(WebException ex, string name)
    {
      var r = ex.Response as HttpWebResponse;
      if (r != null && r.StatusCode == HttpStatusCode.NotFound) return new Exception("没有在 GitHub Releases 找到安装包(" + name + ")。请稍后再试,或到官网手动下载。");
      return new Exception("无法连接到 GitHub:" + ex.Message + "\n请检查网络后重试。");
    }

    // 下载进度:每 0.25 秒刷新一次,速度做指数平滑,避免数字乱跳
    Stopwatch dlWatch; double dlSpeed, dlLastT; long dlLastGot;
    void ReportDownload(long got, long total)
    {
      double t = dlWatch.Elapsed.TotalSeconds;
      if (t - dlLastT < 0.25) return;
      double inst = (got - dlLastGot) / (t - dlLastT);
      dlSpeed = dlSpeed <= 0 ? inst : dlSpeed * 0.75 + inst * 0.25;
      dlLastGot = got; dlLastT = t;
      double sp = dlSpeed;
      Ui(() =>
      {
        if (total > 0) bar.Value = (float)got / total;
        stats.L.Text = total > 0 ? Util.Bytes(got) + " / " + Util.Bytes(total) : Util.Bytes(got);
        stats.R.Text = Util.Bytes(sp) + "/s" + (total > 0 && sp > 0 ? " · 剩余 " + Util.Eta((total - got) / sp) : "");
      });
    }

    void DownloadSingle(string name, string path, long expected)
    {
      long total;
      using (var src = Open(name, out total))
      using (var dst = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None))
      {
        if (total <= 0) total = expected;
        var buf = new byte[81920];
        long got = 0;
        int n;
        while ((n = src.Read(buf, 0, buf.Length)) > 0)
        {
          if (cancel) throw new CancelledException();
          dst.Write(buf, 0, n);
          got += n;
          ReportDownload(got, total);
        }
        if (total > 0 && got != total) throw new Exception("下载不完整(" + Util.Bytes(got) + " / " + Util.Bytes(total) + "),请重试。");
      }
    }

    // 文件被短暂占用(杀毒扫描、索引)时重试,最多约 10 秒
    static void Retry(Action a)
    {
      for (int i = 0; ; i++)
      {
        try { a(); return; }
        catch (Exception ex)
        {
          if (!(ex is IOException || ex is UnauthorizedAccessException) || i >= 9) throw;
          Thread.Sleep(1000);
        }
      }
    }

    static void CopyTree(string from, string to)
    {
      foreach (var d in Directory.GetDirectories(from, "*", SearchOption.AllDirectories))
        Directory.CreateDirectory(Path.Combine(to, d.Substring(from.Length + 1)));
      Directory.CreateDirectory(to);
      foreach (var f in Directory.GetFiles(from, "*", SearchOption.AllDirectories))
      {
        string dest = Path.Combine(to, f.Substring(from.Length + 1));
        Retry(() => File.Copy(f, dest, true));
      }
    }

    const int ChunkSize = 2 * 1024 * 1024, Workers = 8, ChunkRetries = 6;

    // 返回 false 表示服务器不支持 Range(调用方改用单连接下载)
    bool DownloadParallel(string name, string path, long total)
    {
      string url = source.TrimEnd('/') + "/" + name;
      // 先探测:请求第一个字节,确认返回 206
      try
      {
        var probe = Request(url);
        probe.AddRange(0L, 0L);
        using (var r = (HttpWebResponse)probe.GetResponse())
          if (r.StatusCode != HttpStatusCode.PartialContent) return false;
      }
      catch (WebException ex) { throw ConnectError(ex, name); }

      int chunks = (int)((total + ChunkSize - 1) / ChunkSize);
      int next = -1;
      long got = 0;
      Exception failure = null;
      ServicePointManager.DefaultConnectionLimit = Math.Max(ServicePointManager.DefaultConnectionLimit, Workers * 2);
      using (var init = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.ReadWrite)) init.SetLength(total);

      var threads = new List<Thread>();
      for (int w = 0; w < Workers; w++)
      {
        var th = new Thread(() =>
        {
          var buf = new byte[65536];
          using (var fs = new FileStream(path, FileMode.Open, FileAccess.Write, FileShare.ReadWrite))
            while (failure == null && !cancel)
            {
              int c = Interlocked.Increment(ref next);
              if (c >= chunks) return;
              long start = (long)c * ChunkSize, end = Math.Min(total, start + ChunkSize) - 1;
              long pos = start;
              for (int attempt = 0; ; attempt++)
              {
                try
                {
                  var req = Request(url);
                  req.AddRange(pos, end);
                  using (var resp = (HttpWebResponse)req.GetResponse())
                  {
                    if (resp.StatusCode != HttpStatusCode.PartialContent) throw new Exception("服务器不支持分段下载");
                    using (var s = resp.GetResponseStream())
                    {
                      fs.Position = pos;
                      int n;
                      while (pos <= end && (n = s.Read(buf, 0, (int)Math.Min(buf.Length, end - pos + 1))) > 0)
                      {
                        if (cancel || failure != null) return;
                        fs.Write(buf, 0, n);
                        pos += n;
                        Interlocked.Add(ref got, n);
                      }
                    }
                  }
                  if (pos > end) break;
                  throw new IOException("连接中断");
                }
                catch (Exception ex)
                {
                  // 已收到的部分保留,从断点继续;多次失败才放弃
                  if (cancel) return;
                  if (attempt >= ChunkRetries) { failure = ex; return; }
                  Thread.Sleep(1000 * (attempt + 1));
                }
              }
            }
        }) { IsBackground = true };
        threads.Add(th);
        th.Start();
      }

      while (threads.Any(t => t.IsAlive))
      {
        Thread.Sleep(250);
        ReportDownload(Interlocked.Read(ref got), total);
      }
      if (cancel) throw new CancelledException();
      if (failure != null)
      {
        var we = failure as WebException;
        throw we != null ? ConnectError(we, name) : new Exception("下载失败:" + failure.Message + "\n请检查网络后重试。");
      }
      if (Interlocked.Read(ref got) != total) throw new Exception("下载不完整(" + Util.Bytes(got) + " / " + Util.Bytes(total) + "),请重试。");
      ReportDownload(total, total);
      return true;
    }

    void DoInstall(bool desktop, bool start, string langCode)
    {
      ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | (SecurityProtocolType)12288; // TLS 1.2 / 1.3
      Directory.CreateDirectory(tempDir);

      // 1. 版本清单
      string manifest;
      long _;
      using (var s = Open("latest.json", out _))
      using (var r = new StreamReader(s, Encoding.UTF8)) manifest = r.ReadToEnd();
      string version = Util.Json(manifest, "version"), file = Util.Json(manifest, "file"), sha = Util.Json(manifest, "sha256");
      if (string.IsNullOrEmpty(file) || string.IsNullOrEmpty(sha) || file.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        throw new Exception("版本信息格式不正确。");
      Ui(() => side.Version = "正在安装 v" + version);

      // 2. 下载:GitHub 对单个连接常被限速,按 2 MB 分块、8 个连接并行;断线自动续传重试
      string zipPath = Path.Combine(tempDir, file);
      Status("正在下载", "ChronoKey " + version + " · " + file);
      long total;
      long.TryParse(Util.Json(manifest, "size"), out total);
      dlWatch = Stopwatch.StartNew(); dlSpeed = 0; dlLastT = 0; dlLastGot = 0;
      Ui(() => bar.Indeterminate = total <= 0);
      if (IsLocalSource || total <= 0 || !DownloadParallel(file, zipPath, total)) DownloadSingle(file, zipPath, total);

      // 3. 校验(读回整个文件计算 SHA-256)
      Ui(() => { bar.Value = 1; stats.R.Text = "下载完成"; });
      Status("正在校验", "核对 SHA-256,确保文件完整且未被篡改…");
      string actual;
      using (var sha256 = SHA256.Create())
      using (var fs = File.OpenRead(zipPath)) actual = Util.Hex(sha256.ComputeHash(fs));
      if (!actual.Equals(sha.Trim(), StringComparison.OrdinalIgnoreCase))
        throw new Exception("安装包校验失败:SHA-256 与发布信息不一致。文件可能损坏或被篡改,已停止安装。");
      Thread.Sleep(300);

      // 4. 解压到同级临时目录,成功后再替换,避免装一半
      Ui(() => { cancellable = false; pWork.Primary.Enabled = false; Step(2); bar.Value = 0; stats.L.Text = ""; stats.R.Text = ""; });
      Status("正在安装", "正在解压文件…");
      string staging = installDir + ".installing";
      if (Directory.Exists(staging)) Retry(() => Directory.Delete(staging, true));
      Directory.CreateDirectory(staging);
      string stagingFull = Path.GetFullPath(staging) + Path.DirectorySeparatorChar;
      using (var zip = ZipFile.OpenRead(zipPath))
      {
        long sum = Math.Max(1, zip.Entries.Sum(e => e.Length)), done = 0;
        int i = 0, count = zip.Entries.Count;
        foreach (var entry in zip.Entries)
        {
          i++;
          string dest = Path.GetFullPath(Path.Combine(staging, entry.FullName));
          if (!dest.StartsWith(stagingFull, StringComparison.OrdinalIgnoreCase)) throw new Exception("安装包包含非法路径,已停止安装。");
          if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(dest); continue; }
          Directory.CreateDirectory(Path.GetDirectoryName(dest));
          entry.ExtractToFile(dest, true);
          done += entry.Length;
          long d = done; int ii = i; string nm = entry.Name;
          Ui(() => { bar.Value = (float)d / sum; stats.L.Text = ii + " / " + count + " 个文件"; workDetail.Text = nm; });
        }
      }
      if (!File.Exists(Path.Combine(staging, "ChronoKey.exe"))) throw new Exception("安装包内容不完整(缺少 ChronoKey.exe)。");

      Status(null, "正在写入程序文件…");
      if (Directory.Exists(installDir))
      {
        // 覆盖安装:保留便携数据目录
        string portable = Path.Combine(installDir, "ChronoKeyData");
        if (Directory.Exists(portable)) Retry(() => Directory.Move(portable, Path.Combine(staging, "ChronoKeyData")));
        Retry(() => Directory.Delete(installDir, true));
      }
      Directory.CreateDirectory(Path.GetDirectoryName(installDir));
      // 杀毒软件常在解压后短暂锁定新文件:先重试整体改名,仍失败则逐个复制
      try { Retry(() => Directory.Move(staging, installDir)); }
      catch (IOException) { CopyTree(staging, installDir); }
      catch (UnauthorizedAccessException) { CopyTree(staging, installDir); }
      try { if (Directory.Exists(staging)) Directory.Delete(staging, true); } catch { }

      // 5. 卸载程序、快捷方式、"已安装的应用"条目
      Status(null, "正在创建快捷方式…");
      string exe = Path.Combine(installDir, "ChronoKey.exe");
      string uninst = Path.Combine(installDir, "Uninstall.exe");
      File.Copy(Application.ExecutablePath, uninst, true);
      if (desktop) Util.Shortcut(Paths.DesktopLnk, exe, installDir, "ChronoKey 离线密码库");
      if (start) Util.Shortcut(Paths.StartLnk, exe, installDir, "ChronoKey 离线密码库");
      long kb = new DirectoryInfo(installDir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length) / 1024;
      using (var k = Registry.CurrentUser.CreateSubKey(Paths.UninstallKey))
      {
        k.SetValue("DisplayName", "ChronoKey");
        k.SetValue("DisplayVersion", version ?? "");
        k.SetValue("Publisher", Paths.Publisher);
        k.SetValue("DisplayIcon", exe + ",0");
        k.SetValue("InstallLocation", installDir);
        k.SetValue("UninstallString", "\"" + uninst + "\" /uninstall");
        k.SetValue("QuietUninstallString", "\"" + uninst + "\" /uninstall");
        k.SetValue("URLInfoAbout", Paths.Homepage);
        k.SetValue("HelpLink", Paths.Homepage);
        k.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
        k.SetValue("EstimatedSize", (int)Math.Min(int.MaxValue, kb), RegistryValueKind.DWord);
        k.SetValue("NoModify", 1, RegistryValueKind.DWord);
        k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
      }
      // 6. 应用语言包(选择内置三种之外的语言时,随安装一起下载并写入 locales\)
      try { WriteLangPack(langCode); } catch { /* 语言包失败不影响安装 */ }
      try { Directory.Delete(tempDir, true); } catch { }

      Ui(() =>
      {
        busy = false; finished = true;
        bar.Value = 1;
        side.Anim.Mode = 2;
        doneBody.Text = "ChronoKey " + version + " 已安装到\n" + installDir;
        Step(3); Show(pDone);
      });
    }

    void StartUninstall()
    {
      if (Util.IsAppRunning()) { MessageBox.Show(this, "ChronoKey 正在运行。请先退出,再继续卸载。", "需要退出 ChronoKey", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
      bool keep = chkKeep.Checked;
      if (!keep)
      {
        var r = MessageBox.Show(this, "将永久删除保险库和全部自动快照,无法恢复。\n确定要删除吗?", "删除保险库数据", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
        if (r != DialogResult.Yes) return;
      }
      busy = true; cancellable = false;
      bar.Value = 0;
      Step(1); Show(pWork);
      side.Anim.Mode = 1;
      new Thread(() =>
      {
        try { DoUninstall(keep); }
        catch (Exception ex) { Fail(ex); }
      }) { IsBackground = true }.Start();
    }

    void DoUninstall(bool keep)
    {
      string self = Path.GetFullPath(Application.ExecutablePath);
      Status(null, "正在删除快捷方式…");
      foreach (var lnk in new[] { Paths.DesktopLnk, Paths.StartLnk }) try { if (File.Exists(lnk)) File.Delete(lnk); } catch { }
      Ui(() => bar.Value = 0.1f);

      // 只删除确实是 ChronoKey 的目录(含 ChronoKey.exe),防止注册表被改写后误删
      if (Directory.Exists(installDir) && File.Exists(Path.Combine(installDir, "ChronoKey.exe")) && ValidateDir(installDir) == null)
      {
        Status(null, "正在删除程序文件…");
        var files = Directory.GetFiles(installDir, "*", SearchOption.AllDirectories);
        int i = 0;
        foreach (var f in files)
        {
          i++;
          if (Path.GetFullPath(f).Equals(self, StringComparison.OrdinalIgnoreCase)) continue; // 自己由退出后的 cmd 删除
          if (!keep || !f.StartsWith(Path.Combine(installDir, "ChronoKeyData") + "\\", StringComparison.OrdinalIgnoreCase))
            try { File.Delete(f); } catch { }
          int ii = i; string nm = Path.GetFileName(f);
          if (i % 5 == 0 || i == files.Length) Ui(() => { bar.Value = 0.1f + 0.7f * ii / files.Length; stats.L.Text = ii + " / " + files.Length + " 个文件"; workDetail.Text = nm; });
        }
        foreach (var d in Directory.GetDirectories(installDir, "*", SearchOption.AllDirectories).OrderByDescending(d => d.Length))
          try { if (!Directory.EnumerateFileSystemEntries(d).Any()) Directory.Delete(d); } catch { }
      }

      if (!keep)
      {
        Status(null, "正在删除保险库数据…");
        try { if (Directory.Exists(Paths.UserData)) Directory.Delete(Paths.UserData, true); } catch (Exception ex) { throw new Exception("程序已删除,但保险库数据删除失败:" + ex.Message); }
      }
      Ui(() => bar.Value = 0.95f);
      Status(null, "正在移除卸载项…");
      try { Registry.CurrentUser.DeleteSubKeyTree(Paths.UninstallKey, false); } catch { }

      Ui(() =>
      {
        busy = false; finished = true;
        bar.Value = 1;
        side.Anim.Mode = 2;
        doneBody.Text = keep
          ? "程序已删除。你的保险库数据仍保留在\n" + Paths.UserData + "\n重新安装后可直接解锁。"
          : "程序与保险库数据均已删除。";
        Step(2); Show(pDone);
      });
    }

    // ---------- 窗口外观与关闭 ----------
    protected override CreateParams CreateParams
    {
      get { var p = base.CreateParams; p.ClassStyle |= 0x20000; return p; } // CS_DROPSHADOW
    }

    protected override void WndProc(ref Message m)
    {
      base.WndProc(ref m);
      if (m.Msg == 0x84 && (int)m.Result == 1) m.Result = (IntPtr)2; // 空白处拖动窗口
    }

    protected override void OnLoad(EventArgs e)
    {
      base.OnLoad(e);
      // 居中到工作区(去掉任务栏),而不是整屏;多显示器时以鼠标所在屏幕为准
      var wa = Screen.FromPoint(Cursor.Position).WorkingArea;
      Location = new Point(wa.Left + (wa.Width - Width) / 2, wa.Top + (wa.Height - Height) / 2);
    }

    protected override void OnShown(EventArgs e)
    {
      base.OnShown(e);
      // 从浏览器下载后启动时,窗口常被压在浏览器后面:短暂置顶以确保出现在最前
      TopMost = true; Activate(); TopMost = false;
      if (Auto) AutoLog("bounds=" + Bounds + " workarea=" + Screen.FromControl(this).WorkingArea + " mode=" + (uninstall ? "uninstall" : "install"));
    }

    protected override void OnPaint(PaintEventArgs e)
    {
      base.OnPaint(e);
      using (var pen = new Pen(Theme.Border)) e.Graphics.DrawRectangle(pen, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
      if (busy)
      {
        e.Cancel = true;
        if (cancellable) AskCancel();
        return;
      }
      base.OnFormClosing(e);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
      base.OnFormClosed(e);
      string self = Path.GetFullPath(Application.ExecutablePath);
      if (uninstall)
      {
        if (!finished) return;
        // 删除自己与(已空的)安装目录
        string dirCmd = Directory.Exists(installDir) && !Directory.Exists(Path.Combine(installDir, "ChronoKeyData")) ? " & rmdir /s /q \"" + installDir + "\"" : "";
        Util.AfterExit("del /f /q \"" + self + "\"" + dirCmd);
        return;
      }
      try { Directory.Delete(tempDir, true); } catch { }
      if (!finished) return;
      if (chkLaunch.Checked)
        try { Process.Start(new ProcessStartInfo(Path.Combine(installDir, "ChronoKey.exe")) { WorkingDirectory = installDir, UseShellExecute = true }); } catch { }
      // 安装完成后删除安装程序自身(安装目录中的 Uninstall.exe 是副本,不受影响)
      if (!self.StartsWith(installDir + "\\", StringComparison.OrdinalIgnoreCase))
        Util.AfterExit("del /f /q \"" + self + "\"");
    }
  }
}
