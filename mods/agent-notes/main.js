import { View, div } from "gpui-kit";
import { v_flex, h_flex, Textarea, TextareaState, TextView } from "gpui-base";
import { props, shared, setShared, theme, checking, nextCommand } from "herdr";

export default class AgentNotes extends View {
  init(_props, cx) {
    this.key = "agent-notes.text." + (props()?.notesId ?? "check");
    this.input = TextareaState.new({ placeholder: "Notes for this agent…", value: shared(this.key) ?? props()?.initialText ?? "", rows: 6 });
    this.modeKey = "agent-notes.mode." + (props()?.notesId ?? "check");
    this.preview = shared(this.modeKey) === "preview" || (shared(this.modeKey) == null && Boolean(this.input.value()));
    this.input.on("change", (_e, cx) => {
      setShared(this.key, this.input.value());
      cx.notify();
    });
    if (!checking()) {
      if (props()?.autofocus) this.input.focus();
      cx.spawn(async cx => {
        for (;;) {
          const command = await nextCommand();
          if (command === "focus") this.input.focus();
        }
      });

    }
  }

  close() {
    if (!checking()) setShared(this.key, this.input.value());
  }

  render() {
    const t = theme();
    const mode = (id, label, preview) => div().id(id).px(7).py(3).rounded(4).text_size(11)
      .bg(this.preview === preview ? t.selected : "#00000000")
      .text_color(this.preview === preview ? t.foreground : t.muted).cursor_pointer()
      .on_click((_e, cx) => {
        this.preview = preview;
        setShared(this.modeKey, preview ? "preview" : "edit");
        if (!preview) this.input.focus();
        cx.notify();
      }).child(label);
    return v_flex().id("agent-notes").size_full().min_h(0).p(10).gap(6).bg(t.background)
      .child(h_flex().flex_none().items_center().gap(3)
        .child(mode("notes-preview", "Preview", true))
        .child(mode("notes-edit", "Edit", false)))
      .when(!this.preview, el => el.child(Textarea.new(this.input).flex_1().min_h(0).w_full().text_size(13).text_color(t.foreground)))
      .when(this.preview, el => el.child(div().id("notes-markdown").flex_1().min_h(0).overflow_y_scrollbar().text_size(13).text_color(t.foreground)
        .child(TextView.markdown("agent-notes-markdown", this.input.value() || "*No notes yet. Choose Edit to add some.*"))))
      .child(div().text_size(10).text_color(t.dim).child("Saved automatically · stays with this agent"));
  }
}
