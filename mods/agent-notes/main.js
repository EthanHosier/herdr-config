import { View, div } from "gpui-kit";
import { v_flex, Textarea, TextareaState } from "gpui-base";
import { props, shared, setShared, theme, checking, nextCommand } from "herdr";

export default class AgentNotes extends View {
  init(_props, cx) {
    this.key = "agent-notes.text." + (props()?.notesId ?? "check");
    this.input = TextareaState.new({ placeholder: "Notes for this agent…", value: shared(this.key) ?? props()?.initialText ?? "", rows: 6 });
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
    return v_flex().id("agent-notes").size_full().min_h(0).p(10).gap(6).bg(t.background)
      .child(Textarea.new(this.input).flex_1().min_h(0).w_full().text_size(13).text_color(t.foreground))
      .child(div().text_size(10).text_color(t.dim).child("Saved automatically · stays with this agent"));
  }
}
