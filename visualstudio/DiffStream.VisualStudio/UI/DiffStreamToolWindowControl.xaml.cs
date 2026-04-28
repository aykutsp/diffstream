using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using DiffStream.VisualStudio.Core;

namespace DiffStream.VisualStudio.UI
{
    public partial class DiffStreamToolWindowControl : UserControl
    {
        private readonly DiffStreamController? controller;
        private readonly ICollectionView eventsView;

        public DiffStreamToolWindowControl(DiffStreamController? controller)
        {
            InitializeComponent();
            this.controller = controller;
            DataContext = controller?.FeedStore;
            eventsView = CollectionViewSource.GetDefaultView(controller?.FeedStore.Events);
            eventsView.Filter = FilterEvent;
        }

        private bool FilterEvent(object item)
        {
            if (item is not ChangeEventViewModel model)
            {
                return false;
            }

            var query = SearchBox?.Text?.Trim();
            return string.IsNullOrEmpty(query) ||
                   model.RelativePath.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void SearchChanged(object sender, TextChangedEventArgs e)
        {
            eventsView.Refresh();
        }

        private void PauseClick(object sender, RoutedEventArgs e) => controller?.Pause();

        private void ResumeClick(object sender, RoutedEventArgs e) => controller?.Resume();

        private void ClearClick(object sender, RoutedEventArgs e) => controller?.ClearFeed();

        private void StartClick(object sender, RoutedEventArgs e) => controller?.Start();

        private void StopClick(object sender, RoutedEventArgs e) => controller?.Stop();
    }
}
