import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Video, Shield, Download, Eye, EyeOff, ExternalLink, FileSpreadsheet, AlertCircle, CheckCircle, Info, Folder, Copy, Check, Sparkles, Loader2, Lock, Unlock } from "lucide-react";

interface VimeoVideo {
  title: string;
  link: string;
  downloadLink: string;
  thumbnailUrl?: string;
  aiTitle?: string;
  videoId?: string;
}

interface VimeoFolder {
  uri: string;
  name: string;
  description?: string;
  privacy: {
    view: string;
  };
}

interface VimeoApiResponse {
  data: Array<{
    name: string;
    link: string;
    uri: string;
    pictures?: {
      sizes: Array<{
        width: number;
        height: number;
        link: string;
      }>;
    };
    download?: Array<{
      link: string;
    }>;
  }>;
  paging: {
    next?: string;
    page: number;
    per_page: number;
    total: number;
  };
}

interface VimeoFoldersApiResponse {
  data: VimeoFolder[];
}

export default function Home() {
  const [apiToken, setApiToken] = useState('');
  const [folders, setFolders] = useState<VimeoFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<VimeoFolder | null>(null);
  const [videos, setVideos] = useState<VimeoVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set());
  const [aiAnalyzing, setAiAnalyzing] = useState<Set<string>>(new Set());
  const [bulkAiProcessing, setBulkAiProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{processed: number, total: number, errors: number}>({processed: 0, total: 0, errors: 0});
  const [aiUnlocked, setAiUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const { toast } = useToast();

  // Copy link to clipboard
  const copyToClipboard = async (link: string, videoTitle: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinks(prev => new Set(Array.from(prev).concat([link])));
      toast({
        title: "Link Copiato",
        description: `Link di "${videoTitle}" copiato negli appunti`,
      });
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedLinks(prev => {
          const newSet = new Set(prev);
          newSet.delete(link);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile copiare il link. Prova a copiarlo manualmente.",
      });
    }
  };

  // Load existing AI titles from database
  const loadExistingAiTitles = async (videoList: VimeoVideo[]) => {
    const videoIds = videoList.map(v => v.videoId).filter(Boolean);
    if (videoIds.length === 0) return videoList;

    try {
      const response = await fetch('/api/get-ai-titles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoIds }),
      });

      if (response.ok) {
        const data = await response.json();
        return videoList.map(video => ({
          ...video,
          aiTitle: data.titles[video.videoId!] || video.aiTitle
        }));
      }
    } catch (err) {
      console.error('Error loading existing AI titles:', err);
    }
    
    return videoList;
  };

  // AI title extraction from thumbnail
  const extractAiTitle = async (video: VimeoVideo) => {
    if (!video.videoId || !video.thumbnailUrl) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Thumbnail non disponibile per questo video",
      });
      return;
    }

    setAiAnalyzing(prev => new Set(Array.from(prev).concat([video.videoId!])));
    
    try {
      const response = await fetch('/api/analyze-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.videoId,
          thumbnailUrl: video.thumbnailUrl,
          originalTitle: video.title
        }),
      });

      if (!response.ok) {
        throw new Error('Analisi AI fallita');
      }

      const data = await response.json();
      
      // Update the video with AI title
      setVideos(prev => prev.map(v => 
        v.videoId === video.videoId 
          ? { ...v, aiTitle: data.aiTitle }
          : v
      ));

      toast({
        title: "Titolo AI Estratto",
        description: `"${data.aiTitle}"`,
      });

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Errore AI",
        description: "Impossibile analizzare la thumbnail. Riprova.",
      });
    } finally {
      setAiAnalyzing(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.videoId!);
        return newSet;
      });
    }
  };

  // Unlock AI functions with password
  const unlockAi = () => {
    if (unlockPassword === 'MG2025') {
      setAiUnlocked(true);
      setShowUnlockDialog(false);
      setUnlockPassword('');
      toast({
        title: "AI Sbloccata",
        description: "Funzioni AI attivate con successo!",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Password Errata",
        description: "La password inserita non è corretta.",
      });
    }
  };

  // Bulk AI title generation for all videos
  const generateAllAiTitles = async () => {
    const videosToProcess = videos.filter(v => v.videoId && v.thumbnailUrl && !v.aiTitle);
    
    if (videosToProcess.length === 0) {
      toast({
        title: "Nessun Video da Processare",
        description: "Tutti i video hanno già un titolo AI o non hanno thumbnail disponibili",
      });
      return;
    }

    setBulkAiProcessing(true);
    setBulkProgress({processed: 0, total: videosToProcess.length, errors: 0});

    try {
      const videosPayload = videosToProcess.map(video => ({
        videoId: video.videoId!,
        thumbnailUrl: video.thumbnailUrl!,
        originalTitle: video.title
      }));

      const response = await fetch('/api/analyze-thumbnails-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videos: videosPayload }),
      });

      if (!response.ok) {
        throw new Error('Elaborazione bulk fallita');
      }

      const data = await response.json();
      
      // Update videos with AI titles
      setVideos(prev => prev.map(video => {
        const result = data.results.find((r: any) => r.videoId === video.videoId);
        if (result) {
          return { ...video, aiTitle: result.aiTitle };
        }
        return video;
      }));

      setBulkProgress({
        processed: data.successful,
        total: data.total,
        errors: data.failed
      });

      toast({
        title: "Elaborazione Bulk Completata",
        description: `${data.successful} titoli generati con successo${data.failed > 0 ? `, ${data.failed} errori` : ''}`,
      });

      if (data.errors && data.errors.length > 0) {
        console.error('Bulk processing errors:', data.errors);
      }

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Errore Elaborazione Bulk",
        description: "Impossibile elaborare i video in modalità bulk. Riprova.",
      });
      console.error('Bulk AI processing error:', err);
    } finally {
      setBulkAiProcessing(false);
    }
  };

  // Fetch folders from Vimeo API
  const fetchFolders = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token first');
      return;
    }

    setLoadingFolders(true);
    setError('');
    setSuccess('');
    setFolders([]);
    setSelectedFolder(null);
    setVideos([]);

    try {
      // API request to fetch user's folders
      const response = await fetch('https://api.vimeo.com/me/folders', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API token. Please check your credentials.');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`Failed to fetch folders: ${response.status}`);
        }
      }

      const data: VimeoFoldersApiResponse = await response.json();
      setFolders(data.data);
      
      if (data.data.length === 0) {
        setSuccess('API connection successful, but no folders found. This might be because:');
        setError('• Your API token may need additional permissions (scopes) to access folders\n• You may not have any folders created in your Vimeo account\n• Check that your token has "private" scope for accessing personal content');
      } else {
        setSuccess(`Successfully loaded ${data.data.length} folders from your account`);
        toast({
          title: "Success",
          description: `Loaded ${data.data.length} folders successfully`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoadingFolders(false);
    }
  };

  // Fetch all videos from user account (not from specific album)
  const fetchAllVideos = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setSelectedFolder(null);

    try {
      // Fetch all videos with pagination support (using page parameter)
      let allVideos: VimeoVideo[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 100;

      while (hasMorePages) {
        // Update success message to show progress
        setSuccess(`Fetching all your videos... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        const url = `https://api.vimeo.com/me/videos?per_page=${perPage}&page=${currentPage}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid API token. Please check your credentials.');
          } else if (response.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
          } else {
            throw new Error(`API request failed: ${response.status}`);
          }
        }

        const data: VimeoApiResponse = await response.json();
        
        // Extract video information from this page
        const pageVideos: VimeoVideo[] = data.data.map(video => {
          // Extract video ID from URI (format: /videos/123456789)
          const videoId = video.uri.split('/').pop() || '';
          // Get best quality thumbnail
          const thumbnailUrl = video.pictures?.sizes?.length 
            ? video.pictures.sizes[video.pictures.sizes.length - 1].link 
            : undefined;
          
          return {
            title: video.name,
            link: video.link,
            downloadLink: video.download ? video.download[0]?.link : 'Not available',
            videoId,
            thumbnailUrl
          };
        });
        
        // Add to total collection
        allVideos = [...allVideos, ...pageVideos];
        
        // Check if we have more pages (if we got less than perPage, we're done)
        hasMorePages = pageVideos.length === perPage;
        currentPage++;
        
        // Small delay to be nice to the API
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const videoList = allVideos;

      // Sort videos by title (natural sort for numbers in titles)  
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setVideos(videosWithAiTitles);
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from your account`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos successfully`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch videos from Vimeo API
  const fetchVideos = async () => {
    // Input validation
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token');
      return;
    }
    
    if (!selectedFolder) {
      setError('Please select a folder first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Extract folder ID from URI (format: /folders/12345678)
      const folderId = selectedFolder.uri.split('/').pop();
      if (!folderId) {
        throw new Error('Invalid folder ID');
      }

      // Fetch all videos with pagination support (using page parameter instead of nextUrl)
      let allVideos: VimeoVideo[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 100;

      while (hasMorePages) {
        // Update success message to show progress
        setSuccess(`Fetching videos... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        const url = `https://api.vimeo.com/me/folders/${folderId}/videos?per_page=${perPage}&page=${currentPage}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid API token. Please check your credentials.');
          } else if (response.status === 404) {
            throw new Error('Folder not found. Please check the folder ID.');
          } else if (response.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
          } else {
            throw new Error(`API request failed: ${response.status}`);
          }
        }

        const data: VimeoApiResponse = await response.json();
        
        // Extract video information from this page
        const pageVideos: VimeoVideo[] = data.data.map(video => {
          // Extract video ID from URI (format: /videos/123456789)
          const videoId = video.uri.split('/').pop() || '';
          // Get best quality thumbnail
          const thumbnailUrl = video.pictures?.sizes?.length 
            ? video.pictures.sizes[video.pictures.sizes.length - 1].link 
            : undefined;
          
          return {
            title: video.name,
            link: video.link,
            downloadLink: video.download ? video.download[0]?.link : 'Not available',
            videoId,
            thumbnailUrl
          };
        });
        
        // Add to total collection
        allVideos = [...allVideos, ...pageVideos];
        
        // Check if we have more pages (if we got less than perPage, we're done)
        hasMorePages = pageVideos.length === perPage;
        currentPage++;
        
        // Small delay to be nice to the API
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const videoList = allVideos;

      setVideos(videoList);
      // Sort videos by title (natural sort for numbers in titles)  
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setVideos(videosWithAiTitles);
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from folder "${selectedFolder.name}"`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos successfully`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Export videos to Excel file using SheetJS
  const exportToExcel = () => {
    if (videos.length === 0) {
      setError('No videos to export. Please fetch videos first.');
      return;
    }

    try {
      // Create worksheet data
      const worksheetData = [
        ['Titolo Originale', 'Titolo AI', 'Video Link', 'Download Link'],
        ...videos.map(video => [video.title, video.aiTitle || '', video.link, video.downloadLink])
      ];

      // Create workbook and worksheet using SheetJS
      const workbook = (window as any).XLSX.utils.book_new();
      const worksheet = (window as any).XLSX.utils.aoa_to_sheet(worksheetData);

      // Add worksheet to workbook
      (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, 'Vimeo Videos');

      // Generate Excel file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      // Create filename based on source
      const folderId = selectedFolder?.uri.split('/').pop();
      const filename = folderId ? `vimeo_videos_folder_${folderId}_${timestamp}.xlsx` : `vimeo_all_videos_${timestamp}.xlsx`;
      
      // Download file
      (window as any).XLSX.writeFile(workbook, filename);
      setSuccess(`Excel file "${filename}" has been downloaded successfully!`);
      toast({
        title: "Export Successful",
        description: `Excel file "${filename}" has been downloaded`,
      });
    } catch (err) {
      setError('Failed to export Excel file. Please try again.');
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel file. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <Video className="h-8 w-8 text-blue-600" />
            Vimeo Video Exporter
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Export video titles and links from your Vimeo albums to Excel files. 
            Enter your API token, select an album, and export to Excel with just a few clicks.
          </p>
        </div>

        {/* Security Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <p className="font-medium mb-1">Security & Compliance Notice</p>
            <p className="text-sm">Use your own Vimeo API token and respect Vimeo's terms of service. 
            Your API token is stored temporarily in memory only and is not saved to your device.</p>
          </AlertDescription>
        </Alert>

        {/* Input Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-gray-600" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API Token Input */}
            <div className="space-y-2">
              <Label htmlFor="api-token">Vimeo API Token</Label>
              <div className="relative">
                <Input
                  id="api-token"
                  type={showToken ? "text" : "password"}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Enter your Vimeo API token"
                  className="pr-10"
                  data-testid="input-api-token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  data-testid="button-toggle-token-visibility"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Get your API token from{" "}
                <a href="https://developer.vimeo.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Vimeo Developer
                </a>
                <br />
                <strong>Important:</strong> Your token needs "private" scope to access albums
              </p>
            </div>

            {/* Load Albums Button */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={fetchFolders}
                  disabled={loadingFolders || !apiToken.trim()}
                  variant="outline"
                  className="w-full"
                  data-testid="button-load-folders"
                >
                  {loadingFolders ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Folder className="h-4 w-4 mr-2" />
                      Load Folders
                    </>
                  )}
                </Button>
                <Button
                  onClick={fetchAllVideos}
                  disabled={loading || !apiToken.trim()}
                  variant="outline"
                  className="w-full"
                  data-testid="button-load-all-videos"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Load All Videos
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Load folders OR load all your videos directly (if you don't use folders)
              </p>
            </div>

            {/* Folder Selection */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="folder-select">Select Folder</Label>
                <Select onValueChange={(value) => {
                  const folder = folders.find(f => f.uri === value);
                  setSelectedFolder(folder || null);
                  setVideos([]); // Clear videos when folder changes
                  setError('');
                  setSuccess('');
                }} data-testid="select-folder">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a folder to export videos from" />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.uri} value={folder.uri} data-testid={`folder-option-${folder.uri.split('/').pop()}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{folder.name}</span>
                          {folder.description && (
                            <span className="text-xs text-gray-500 truncate max-w-60">
                              {folder.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {selectedFolder ? `Selected: ${selectedFolder.name}` : 'Select a folder to continue'}
                </p>
              </div>
            )}

            {/* Fetch Videos Button */}
            {selectedFolder && (
              <Button
                onClick={fetchVideos}
                disabled={loading}
                className="w-full"
                data-testid="button-fetch-videos"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Fetching Videos...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Fetch Videos from "{selectedFolder.name}"
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6" data-testid="alert-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="whitespace-pre-line">{error}</div>
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50" data-testid="alert-success">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Videos Table */}
        {videos.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                  Video Results ({videos.length} videos)
                </CardTitle>
                <div className="flex gap-2">
                  {!aiUnlocked ? (
                    <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="bg-amber-50 hover:bg-amber-100 border-amber-200"
                          data-testid="button-unlock-ai"
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Sblocca AI
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md" data-testid="dialog-unlock-ai">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Sblocca Funzioni AI
                          </DialogTitle>
                          <DialogDescription>
                            Inserisci la password per accedere alle funzioni AI protette.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="unlock-password">Password</Label>
                            <Input
                              id="unlock-password"
                              type="password"
                              value={unlockPassword}
                              onChange={(e) => setUnlockPassword(e.target.value)}
                              placeholder="Inserisci la password"
                              onKeyDown={(e) => e.key === 'Enter' && unlockAi()}
                              data-testid="input-unlock-password"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={unlockAi} className="flex-1" data-testid="button-confirm-unlock">
                              <Unlock className="h-4 w-4 mr-2" />
                              Sblocca
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setShowUnlockDialog(false);
                                setUnlockPassword('');
                              }}
                              data-testid="button-cancel-unlock"
                            >
                              Annulla
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button
                      onClick={generateAllAiTitles}
                      disabled={bulkAiProcessing || videos.filter(v => v.videoId && v.thumbnailUrl && !v.aiTitle).length === 0}
                      variant="outline"
                      className="bg-purple-50 hover:bg-purple-100 border-purple-200"
                      data-testid="button-generate-all-ai-titles"
                    >
                      {bulkAiProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generando... ({bulkProgress.processed}/{bulkProgress.total})
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Genera Tutti i Titoli AI
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={exportToExcel}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-export-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export to Excel
                  </Button>
                </div>
              </div>
              {!aiUnlocked && (
                <Alert className="mt-4 border-amber-200 bg-amber-50">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <p className="font-medium mb-1">Funzioni AI Protette</p>
                    <p className="text-sm">Le funzioni AI sono protette da password. Clicca "Sblocca AI" per accedere alla generazione automatica dei titoli.</p>
                  </AlertDescription>
                </Alert>
              )}
              {bulkAiProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(bulkProgress.processed / bulkProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Elaborazione AI in corso: {bulkProgress.processed} di {bulkProgress.total} video processati
                    {bulkProgress.errors > 0 && ` (${bulkProgress.errors} errori)`}
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo Originale</TableHead>
                      <TableHead>Titolo AI</TableHead>
                      <TableHead>Video Link</TableHead>
                      <TableHead>Download Link</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((video, index) => (
                      <TableRow key={index} data-testid={`row-video-${index}`}>
                        <TableCell className="font-medium" data-testid={`text-title-${index}`}>
                          <div className="flex items-center gap-2">
                            <span className="flex-1">{video.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(video.title, video.title)}
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                              data-testid={`button-copy-original-title-${index}`}
                            >
                              {copiedLinks.has(video.title) ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs" data-testid={`text-ai-title-${index}`}>
                          {video.aiTitle ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-700 font-medium flex-1">{video.aiTitle}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(video.aiTitle!, video.title + ' (AI Title)')}
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                                data-testid={`button-copy-ai-title-${index}`}
                              >
                                {copiedLinks.has(video.aiTitle!) ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ) : aiUnlocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => extractAiTitle(video)}
                              disabled={!video.thumbnailUrl || aiAnalyzing.has(video.videoId!)}
                              className="flex items-center gap-1 h-8 px-2"
                              data-testid={`button-ai-title-${index}`}
                            >
                              {aiAnalyzing.has(video.videoId!) ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span className="text-xs">Generando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3" />
                                  <span className="text-xs">AI Title</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Lock className="h-3 w-3" />
                              <span>AI Bloccata</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <a 
                            href={video.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            data-testid={`link-video-${index}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Video
                          </a>
                        </TableCell>
                        <TableCell>
                          {video.downloadLink !== 'Not available' ? (
                            <a 
                              href={video.downloadLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 hover:underline flex items-center gap-1"
                              data-testid={`link-download-${index}`}
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-500 italic" data-testid={`text-unavailable-${index}`}>
                              Not available
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(video.link, video.title)}
                              className="flex items-center gap-1 h-8 px-2"
                              data-testid={`button-copy-video-${index}`}
                            >
                              {copiedLinks.has(video.link) ? (
                                <>
                                  <Check className="h-3 w-3 text-green-600" />
                                  <span className="text-xs">Copiato!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span className="text-xs">Copia</span>
                                </>
                              )}
                            </Button>
                            {video.downloadLink !== 'Not available' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(video.downloadLink, video.title + ' (Download)')}
                                className="flex items-center gap-1 h-8 px-2"
                                data-testid={`button-copy-download-${index}`}
                              >
                                {copiedLinks.has(video.downloadLink) ? (
                                  <>
                                    <Check className="h-3 w-3 text-green-600" />
                                    <span className="text-xs">Copiato!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span className="text-xs">DL</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Alert className="mt-8 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              How to Use This App
            </h3>
            <ol className="text-blue-800 space-y-2 list-decimal list-inside text-sm">
              <li>
                Create a Vimeo app at{" "}
                <a href="https://developer.vimeo.com/apps" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                  Vimeo Developer Portal
                </a>
                {" "}and generate a Personal Access Token
              </li>
              <li>
                <strong>Important:</strong> Make sure your token has at least these scopes:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><code className="bg-blue-100 px-1 rounded text-xs">private</code> - to access your personal folders</li>
                  <li><code className="bg-blue-100 px-1 rounded text-xs">public</code> - to access public content</li>
                  <li><code className="bg-blue-100 px-1 rounded text-xs">video_files</code> - to access download links (optional)</li>
                </ul>
              </li>
              <li>Enter your API token and choose one of two options:</li>
              <li className="ml-4">
                <strong>Option A:</strong> Click "Load Folders" → Select a folder → Click "Fetch Videos"
              </li>
              <li className="ml-4">
                <strong>Option B:</strong> Click "Load All Videos" to get all your videos directly (no folders needed)
              </li>
              <li>Review the video list and click "Export to Excel" to download the data</li>
            </ol>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
