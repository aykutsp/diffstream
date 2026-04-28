using System.Collections.ObjectModel;
using System.Linq;
using System.Windows.Threading;

namespace DiffStream.VisualStudio.Core
{
    public sealed class FeedStore : ObservableObject
    {
        private readonly Dispatcher dispatcher;
        private readonly int maxItems;

        public FeedStore(Dispatcher dispatcher, int maxItems = 300)
        {
            this.dispatcher = dispatcher;
            this.maxItems = maxItems;
        }

        public ObservableCollection<ChangeEventViewModel> Events { get; } = new ObservableCollection<ChangeEventViewModel>();

        public void Add(ChangeEvent changeEvent)
        {
            _ = dispatcher.BeginInvoke(new System.Action(() =>
            {
                Events.Insert(0, new ChangeEventViewModel(changeEvent));
                while (Events.Count > maxItems)
                {
                    Events.Remove(Events.Last());
                }
            }));
        }

        public void Clear()
        {
            _ = dispatcher.BeginInvoke(new System.Action(Events.Clear));
        }
    }
}
