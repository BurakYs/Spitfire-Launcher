<script lang="ts">
  import { t } from '$lib/utils/util';
</script>

<p>{@html $t('library.app.startedDownload', { el: '<a class="text-blue-500 hover:underline" href="/downloader/downloads">', elEnd: '</a>' })}</p>