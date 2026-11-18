// kt-hub: the home page of the kbrdn-threads layout (#46). Until it is drawn, only its indexer lives
// here (index.ts, #44), run by hand or by the page; this view draws nothing and is placed nowhere.
import { View, div } from "gpui-kit";

export default class Hub extends View {
  render() {
    return div();
  }
}
