import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Video, Shield, Download, Eye, EyeOff, ExternalLink, FileSpreadsheet, AlertCircle, CheckCircle, Info, Folder, Copy, Check, Sparkles, Loader2, Lock, Unlock, Search, Calendar } from "lucide-react";

interface VimeoVideo {
  title: string;
  link: string;
  downloadLink: string;
  thumbnailUrl?: string;
  aiTitle?: string;
  videoId?: string;
  duration?: number; // Duration in seconds
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
    duration?: number; // Duration in seconds
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
  const [userOpenAiKey, setUserOpenAiKey] = useState('');
  const [unlockMethod, setUnlockMethod] = useState<'password' | 'api-key'>('password');
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allVideosLoaded, setAllVideosLoaded] = useState<VimeoVideo[]>([]);
  const [provider, setProvider] = useState<'vimeo' | 'bunny' | 'bunny-stream' | 'wistia' | 'vdocipher' | 'zoom'>('vimeo');
  const [bunnyApiKey, setBunnyApiKey] = useState('');
  const [bunnyStorageZone, setBunnyStorageZone] = useState('');
  const [bunnyStreamApiKey, setBunnyStreamApiKey] = useState('');
  const [bunnyLibraryId, setBunnyLibraryId] = useState('');
  const [bunnyCollections, setBunnyCollections] = useState<VimeoFolder[]>([]);
  const [loadingBunnyCollections, setLoadingBunnyCollections] = useState(false);
  const [wistiaApiToken, setWistiaApiToken] = useState('');
  const [wistiaProjects, setWistiaProjects] = useState<VimeoFolder[]>([]);
  const [loadingWistiaProjects, setLoadingWistiaProjects] = useState(false);
  const [vdocipherApiKey, setVdocipherApiKey] = useState('');
  const [zoomApiKey, setZoomApiKey] = useState('');
  const [zoomApiSecret, setZoomApiSecret] = useState('');
  const [zoomAccountId, setZoomAccountId] = useState('');
  const [loadingZoomRecordings, setLoadingZoomRecordings] = useState(false);
  const [vdocipherFolders, setVdocipherFolders] = useState<VimeoFolder[]>([]);
  const [loadingVdocipherFolders, setLoadingVdocipherFolders] = useState(false);
  const { toast } = useToast();

  // Format duration from seconds to MM:SS format
  const formatDuration = (durationInSeconds?: number): string => {
    if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
    
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get security notice message based on selected provider
  const getSecurityNoticeMessage = (provider: 'vimeo' | 'bunny' | 'bunny-stream' | 'wistia' | 'vdocipher' | 'zoom') => {
    switch (provider) {
      case 'vimeo':
        return 'Use your own Vimeo API token and respect Vimeo\'s terms of service. Your API token is stored temporarily in memory only and is not saved to your device.';
      case 'bunny':
        return 'Use your own Bunny.net Storage API key and respect Bunny.net\'s terms of service. Your API key is stored temporarily in memory only and is not saved to your device.';
      case 'bunny-stream':
        return 'Use your own Bunny.net Stream API key and Library ID and respect Bunny.net\'s terms of service. Your API credentials are stored temporarily in memory only and are not saved to your device.';
      case 'wistia':
        return 'Use your own Wistia API token and respect Wistia\'s terms of service. Your API token is stored temporarily in memory only and is not saved to your device.';
      case 'vdocipher':
        return 'Use your own VdoCipher API secret key and respect VdoCipher\'s terms of service. Your API key is stored temporarily in memory only and is not saved to your device.';
      case 'zoom':
        return 'Use your own Zoom Server-to-Server OAuth app credentials and respect Zoom\'s terms of service. Your API credentials are stored temporarily in memory only and are not saved to your device.';
      default:
        return 'Use your own API credentials and respect the service\'s terms of service. Your API credentials are stored temporarily in memory only and are not saved to your device.';
    }
  };

  // Apply filters when search query or date filter changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, dateFilter, allVideosLoaded]);

  // Regenerate thumbnail for Bunny.net Stream video
  const regenerateThumbnail = async (video: VimeoVideo) => {
    if (!bunnyStreamApiKey.trim() || !bunnyLibraryId.trim() || !video.videoId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Missing Bunny.net credentials or video ID",
      });
      return;
    }

    try {
      // Update video with thumbnailTime to force thumbnail regeneration
      const url = `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos/${video.videoId}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'AccessKey': bunnyStreamApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thumbnailTime: 5000, // Generate thumbnail at 5 seconds
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to regenerate thumbnail: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Bunny.net thumbnail response:', responseData);

      // Wait a moment for thumbnail generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to get the thumbnail URL from the response or use different formats
      let updatedThumbnailUrl = responseData.thumbnailUrl || responseData.thumbnail;
      
      if (!updatedThumbnailUrl) {
        // Use the correct Bunny.net thumbnail pattern
        const playbackZoneHostname = 'vz-b4e8eb65-16e.b-cdn.net';
        updatedThumbnailUrl = `https://${playbackZoneHostname}/${video.videoId}/thumbnail.jpg?v=${Date.now()}`;
        
        console.log('Generated correct thumbnail URL:', updatedThumbnailUrl);
      }
      
      setVideos(prev => prev.map(v => 
        v.videoId === video.videoId 
          ? { ...v, thumbnailUrl: updatedThumbnailUrl }
          : v
      ));

      setAllVideosLoaded(prev => prev.map(v => 
        v.videoId === video.videoId 
          ? { ...v, thumbnailUrl: updatedThumbnailUrl }
          : v
      ));

      // Save to localStorage to persist across reloads
      const savedThumbnails = JSON.parse(localStorage.getItem('bunnynet_thumbnails') || '{}');
      savedThumbnails[video.videoId] = updatedThumbnailUrl;
      localStorage.setItem('bunnynet_thumbnails', JSON.stringify(savedThumbnails));

      toast({
        title: "Thumbnail Regenerated",
        description: `Thumbnail generated for "${video.title}". You can now use AI analysis!`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate thumbnail';
      toast({
        variant: "destructive",
        title: "Regeneration Failed",
        description: errorMessage,
      });
    }
  };

  // Copy link to clipboard
  const copyToClipboard = async (link: string, videoTitle: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinks(prev => new Set(Array.from(prev).concat([link])));
      toast({
        title: "Link Copied",
        description: `Link for "${videoTitle}" copied to clipboard`,
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
        title: "Error",
        description: "Unable to copy link. Please copy it manually.",
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
        title: "Error",
        description: "Thumbnail not available for this video",
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
          originalTitle: video.title,
          userApiKey: userOpenAiKey || undefined
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
        title: "AI Title Generated",
        description: `"${data.aiTitle}"`,
      });

    } catch (err) {
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Unable to analyze thumbnail. Please try again.",
      });
    } finally {
      setAiAnalyzing(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.videoId!);
        return newSet;
      });
    }
  };

  // Unlock AI functions with password or personal API key
  const unlockAi = async () => {
    if (unlockMethod === 'password') {
      try {
        const response = await fetch('/api/verify-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: unlockPassword }),
        });

        const data = await response.json();
        
        if (data.valid) {
          setAiUnlocked(true);
          setShowUnlockDialog(false);
          setUnlockPassword('');
          toast({
            title: "AI Unlocked",
            description: "AI functions activated successfully!",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Incorrect Password",
            description: "The password entered is not correct.",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Unable to verify password. Please try again.",
        });
      }
    } else if (unlockMethod === 'api-key') {
      if (userOpenAiKey.trim().startsWith('sk-')) {
        setAiUnlocked(true);
        setShowUnlockDialog(false);
        setUserOpenAiKey('');
        toast({
          title: "AI Unlocked",
          description: "AI functions activated with your personal API key!",
        });
      } else {
        toast({
          variant: "destructive",
          title: "API Key Non Valida",
          description: "Please enter a valid OpenAI API key (starts with 'sk-')",
        });
      }
    }
  };

  // Bulk AI title generation for all videos
  const generateAllAiTitles = async () => {
    const videosToProcess = videos.filter(v => v.videoId && v.thumbnailUrl && !v.aiTitle);
    
    if (videosToProcess.length === 0) {
      toast({
        title: "Nessun Video da Processare",
        description: "All videos already have an AI title or no thumbnails available",
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
        body: JSON.stringify({ 
          videos: videosPayload,
          userApiKey: userOpenAiKey || undefined
        }),
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
        title: "Bulk Processing Error",
        description: "Unable to process videos in bulk mode. Please try again.",
      });
      console.error('Bulk AI processing error:', err);
    } finally {
      setBulkAiProcessing(false);
    }
  };

  // Fetch videos from Bunny.net Storage API
  const fetchBunnyVideos = async () => {
    if (!bunnyApiKey.trim() || !bunnyStorageZone.trim()) {
      setError('Please enter Bunny.net API key and Storage Zone name');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);
    setSelectedFolder(null);

    try {
      // Bunny.net Storage API endpoint
      const url = `https://storage.bunnycdn.com/${bunnyStorageZone}/`;
      
      const response = await fetch(url, {
        headers: {
          'AccessKey': bunnyApiKey,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Bunny.net API key. Please check your credentials.');
        } else if (response.status === 404) {
          throw new Error('Storage zone not found. Please check the zone name.');
        } else {
          throw new Error(`Bunny.net API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Filter only video files
      const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
      const videoFiles = data.filter((file: any) => 
        file.IsDirectory === false && 
        videoExtensions.some(ext => file.ObjectName.toLowerCase().endsWith(ext))
      );

      // Convert to our video format
      const videoList: VimeoVideo[] = videoFiles.map((file: any) => ({
        title: file.ObjectName,
        link: `https://${bunnyStorageZone}.b-cdn.net/${file.ObjectName}`,
        downloadLink: `https://storage.bunnycdn.com/${bunnyStorageZone}/${file.ObjectName}`,
        videoId: file.Guid || file.ObjectName,
        thumbnailUrl: undefined, // Bunny.net Storage doesn't provide thumbnails by default
        duration: undefined // Bunny.net Storage API doesn't provide duration info
      }));

      // Sort videos by title
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setAllVideosLoaded(videosWithAiTitles);
      setVideos(videosWithAiTitles);
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from Bunny.net storage`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos successfully from Bunny.net`,
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

  // Get date filter for API query
  const getDateFilterParam = (filter: string) => {
    const now = new Date();
    switch (filter) {
      case '1month':
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return oneMonthAgo.toISOString();
      case '3months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return threeMonthsAgo.toISOString();
      case '6months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        return sixMonthsAgo.toISOString();
      case '1year':
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return oneYearAgo.toISOString();
      default:
        return null;
    }
  };

  // Filter videos based on search query
  const filterVideos = (videoList: VimeoVideo[], query: string) => {
    let filtered = videoList;

    // Filter by search query
    if (query.trim()) {
      filtered = filtered.filter(video => 
        video.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    return filtered;
  };

  // Apply real-time search filters
  const applyFilters = () => {
    if (allVideosLoaded.length > 0) {
      const filtered = filterVideos(allVideosLoaded, searchQuery);
      setVideos(filtered);
    }
  };

  // Fetch collections from Bunny.net Stream API  
  const fetchBunnyCollections = async () => {
    if (!bunnyStreamApiKey.trim() || !bunnyLibraryId.trim()) {
      setError('Please enter Bunny.net Stream API key and Library ID first');
      return;
    }

    setLoadingBunnyCollections(true);
    setError('');
    setSuccess('');
    setBunnyCollections([]);

    try {
      const url = `https://video.bunnycdn.com/library/${bunnyLibraryId}/collections`;
      
      const response = await fetch(url, {
        headers: {
          'AccessKey': bunnyStreamApiKey,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Bunny.net Stream API key. Please check your credentials.');
        } else if (response.status === 404) {
          throw new Error('Library not found. Please check the Library ID.');
        } else {
          throw new Error(`Bunny.net Stream API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Convert to our folder format
      const collections: VimeoFolder[] = data.items.map((collection: any) => ({
        uri: collection.guid,
        name: collection.name || 'Untitled Collection',
        description: collection.description || '',
        video_count: collection.videoCount || 0
      }));

      setBunnyCollections(collections);
      setSuccess(`Found ${collections.length} collections in your Bunny.net Stream library`);
      toast({
        title: "Success",
        description: `Found ${collections.length} collections`,
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
      setLoadingBunnyCollections(false);
    }
  };

  // Fetch projects from Wistia API
  const fetchWistiaProjects = async () => {
    if (!wistiaApiToken.trim()) {
      setError('Please enter your Wistia API token first');
      return;
    }

    setLoadingWistiaProjects(true);
    setError('');
    setSuccess('');
    setWistiaProjects([]);

    try {
      const url = 'https://api.wistia.com/v1/projects.json';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${wistiaApiToken}`,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Wistia API token. Please check your credentials.');
        } else {
          throw new Error(`Wistia API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Convert to our folder format
      const projects: VimeoFolder[] = data.map((project: any) => ({
        uri: project.id.toString(),
        name: project.name || 'Untitled Project',
        description: project.description || '',
        video_count: project.mediaCount || 0
      }));

      setWistiaProjects(projects);
      setSuccess(`Found ${projects.length} projects in your Wistia account`);
      toast({
        title: "Success",
        description: `Found ${projects.length} projects`,
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
      setLoadingWistiaProjects(false);
    }
  };

  // Fetch videos from Wistia API
  const fetchWistiaVideos = async () => {
    if (!wistiaApiToken.trim()) {
      setError('Please enter your Wistia API token');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);
    setSelectedFolder(null);

    try {
      // Wistia API endpoint - with project filter if folder is selected
      let url = 'https://api.wistia.com/v1/medias.json';
      if (selectedFolder) {
        url += `?project_id=${selectedFolder.uri}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${wistiaApiToken}`,
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Wistia API token. Please check your credentials.');
        } else {
          throw new Error(`Wistia API request failed: ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Convert to our video format
      const videoList: VimeoVideo[] = data.map((video: any) => ({
        title: video.name || 'Untitled Video',
        link: `https://wistia.com/medias/${video.hashed_id}`,
        downloadLink: video.assets?.find((asset: any) => asset.type === 'OriginalFile')?.url || null,
        videoId: video.hashed_id,
        thumbnailUrl: video.thumbnail?.url
      }));

      // Sort videos by title
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setAllVideosLoaded(videosWithAiTitles);
      setVideos(videosWithAiTitles);
      
      const sourceText = selectedFolder 
        ? `project "${selectedFolder.name}"` 
        : 'Wistia account';
      
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from ${sourceText}`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos from ${sourceText}`,
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

  // Fetch folders from VdoCipher API
  const fetchVdocipherFolders = async () => {
    if (!vdocipherApiKey.trim()) {
      setError('Please enter your VdoCipher API key');
      return;
    }

    setLoadingVdocipherFolders(true);
    setError('');
    setSuccess('');
    setVdocipherFolders([]);
    
    try {
      // Use our backend proxy to avoid CORS issues
      const response = await fetch(`/api/vdocipher/folders?apiKey=${encodeURIComponent(vdocipherApiKey)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert to our folder format
      const folders: VimeoFolder[] = data.folderList?.map((folder: any) => ({
        uri: folder.id,
        name: folder.name || 'Untitled Folder',
        description: `${folder.videosCount} videos, ${folder.foldersCount} subfolders`,
        video_count: folder.videosCount || 0
      })) || [];

      setVdocipherFolders(folders);
      setSuccess(`Found ${folders.length} folders in your VdoCipher account`);
      toast({
        title: "Success",
        description: `Loaded ${folders.length} folders successfully`,
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
      setLoadingVdocipherFolders(false);
    }
  };

  // Fetch videos from VdoCipher API
  const fetchVdocipherVideos = async () => {
    if (!vdocipherApiKey.trim()) {
      setError('Please enter your VdoCipher API key');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);
    setSelectedFolder(null);

    try {
      // Use our backend proxy to avoid CORS issues
      let url = `/api/vdocipher/videos?apiKey=${encodeURIComponent(vdocipherApiKey)}`;
      
      if (selectedFolder) {
        url += `&folderId=${selectedFolder.uri}`;
      } else {
        url += `&folderId=root`;
      }
      url += `&limit=100`;
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert to our video format
      const videoList: VimeoVideo[] = data.rows?.map((video: any) => ({
        title: video.title || 'Untitled Video',
        link: `https://player.vdocipher.com/v2/?otp=${video.otp}&playbackInfo=${video.playbackInfo}`,
        downloadLink: video.status === 'ready' ? 'Available (Contact VdoCipher)' : 'Processing',
        videoId: video.id,
        thumbnailUrl: video.poster || null
      })) || [];

      // Sort videos by title
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setAllVideosLoaded(videosWithAiTitles);
      setVideos(videosWithAiTitles);
      
      const sourceText = selectedFolder 
        ? `folder "${selectedFolder.name}"` 
        : 'VdoCipher account';
      
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from ${sourceText}`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos from ${sourceText}`,
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

  // Fetch recordings from Zoom API
  const fetchZoomRecordings = async () => {
    if (!zoomApiKey.trim() || !zoomApiSecret.trim()) {
      setError('Please enter both Zoom API Key and API Secret');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);

    try {
      // Use our backend proxy to handle Zoom OAuth and API calls
      let url = `/api/zoom/recordings?apiKey=${encodeURIComponent(zoomApiKey)}&apiSecret=${encodeURIComponent(zoomApiSecret)}`;
      if (zoomAccountId.trim()) {
        url += `&accountId=${encodeURIComponent(zoomAccountId)}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert Zoom recordings to our video format
      const videoList: VimeoVideo[] = data.meetings?.reduce((acc: VimeoVideo[], meeting: any) => {
        const meetingRecordings = meeting.recording_files?.map((recording: any) => ({
          title: `${meeting.topic || 'Untitled Meeting'} - ${recording.recording_type?.replace(/_/g, ' ') || 'Recording'}`,
          link: recording.play_url || recording.download_url || '#',
          downloadLink: recording.download_url || 'Contact Zoom Admin',
          videoId: `${meeting.uuid}_${recording.id}`,
          thumbnailUrl: null, // Zoom doesn't provide thumbnails via API
          duration: recording.file_size ? Math.round(recording.file_size / 1000000) : 0, // Convert bytes to MB as rough duration
          description: `Meeting: ${meeting.topic || 'Untitled'} | Date: ${meeting.start_time?.split('T')[0] || 'Unknown'} | Type: ${recording.recording_type || 'Unknown'} | Password: ${meeting.password || 'None'}`,
          password: meeting.password || null
        })) || [];
        
        return acc.concat(meetingRecordings);
      }, []) || [];

      // Sort recordings by title
      const sortedVideoList = videoList.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);
      setAllVideosLoaded(videosWithAiTitles);
      setVideos(videosWithAiTitles);
      
      setSuccess(`Successfully fetched ${sortedVideoList.length} recordings from your Zoom account`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} recordings successfully`,
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

  // Fetch videos from Bunny.net Stream API with pagination support
  const fetchBunnyStreamVideos = async () => {
    if (!bunnyStreamApiKey.trim() || !bunnyLibraryId.trim()) {
      setError('Please enter Bunny.net Stream API key and Library ID');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);
    setSelectedFolder(null);

    try {
      // Fetch all videos with pagination support
      let allVideos: VimeoVideo[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 100; // Bunny.net's default page size

      while (hasMorePages) {
        // Update success message to show progress
        setSuccess(`Fetching videos from Bunny.net... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        // Bunny.net Stream API endpoint with pagination
        let url = `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos?page=${currentPage}&itemsPerPage=${perPage}`;
        if (selectedFolder) {
          url += `&collection=${selectedFolder.uri}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'AccessKey': bunnyStreamApiKey,
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid Bunny.net Stream API key. Please check your credentials.');
          } else if (response.status === 404) {
            throw new Error('Library not found. Please check the Library ID.');
          } else {
            throw new Error(`Bunny.net Stream API request failed: ${response.status}`);
          }
        }

        const data = await response.json();
        
        // Extract video information from this page
        const pageVideos: VimeoVideo[] = data.items.map((video: any) => {
          // Generate correct Bunny.net Stream thumbnail URL using the proper pattern
          // Pattern: https://{PlaybackZoneHostname}/{VideoGUID}/thumbnail.jpg
          const playbackZoneHostname = 'vz-b4e8eb65-16e.b-cdn.net'; // Your specific hostname
          let thumbnailUrl = `https://${playbackZoneHostname}/${video.guid}/thumbnail.jpg`;
          
          return {
            title: video.title || 'Untitled Video',
            link: video.embedUrl || `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${video.guid}`,
            downloadLink: video.mp4Url || null,
            videoId: video.guid,
            thumbnailUrl,
            duration: video.length || video.duration // Duration in seconds from Bunny.net API
          };
        });

        // Add to total collection
        allVideos = [...allVideos, ...pageVideos];
        
        // Check if we have more pages based on response
        // Bunny.net typically includes pagination info or we check if we got less than perPage
        hasMorePages = pageVideos.length === perPage && data.items && data.items.length === perPage;
        currentPage++;
        
        // Small delay to be nice to the API
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Sort videos by title
      const sortedVideoList = allVideos.sort((a, b) => {
        return a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      // Load existing AI titles from database
      const videosWithAiTitles = await loadExistingAiTitles(sortedVideoList);

      // Load saved thumbnails from localStorage
      const savedThumbnails = JSON.parse(localStorage.getItem('bunnynet_thumbnails') || '{}');
      const videosWithThumbnails = videosWithAiTitles.map(video => ({
        ...video,
        thumbnailUrl: savedThumbnails[video.videoId] || video.thumbnailUrl
      }));

      setAllVideosLoaded(videosWithThumbnails);
      setVideos(videosWithThumbnails);
      
      const sourceText = selectedFolder 
        ? `collection "${selectedFolder.name}"` 
        : 'Bunny.net Stream library';
      
      setSuccess(`Successfully fetched ${sortedVideoList.length} videos from ${sourceText}`);
      toast({
        title: "Success",
        description: `Fetched ${sortedVideoList.length} videos from ${sourceText}`,
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

  // Fetch all videos from user account (not from specific album)
  const fetchAllVideos = async () => {
    if (provider === 'bunny') {
      fetchBunnyVideos();
      return;
    }
    
    if (provider === 'bunny-stream') {
      fetchBunnyStreamVideos();
      return;
    }
    
    if (provider === 'wistia') {
      fetchWistiaVideos();
      return;
    }
    
    if (provider === 'vdocipher') {
      fetchVdocipherVideos();
      return;
    }
    
    if (provider === 'zoom') {
      fetchZoomRecordings();
      return;
    }

    // Input validation for Vimeo
    if (!apiToken.trim()) {
      setError('Please enter your Vimeo API token');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setVideos([]);
    setAllVideosLoaded([]);
    setSelectedFolder(null);

    try {
      // Fetch all videos with pagination support (using page parameter)
      let allVideos: VimeoVideo[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const perPage = 100;

      // Build API URL with date filter if specified
      const dateParam = getDateFilterParam(dateFilter);
      const baseUrl = 'https://api.vimeo.com/me/videos';

      while (hasMorePages) {
        // Update success message to show progress
        setSuccess(`Fetching all your videos... Page ${currentPage} (${allVideos.length} videos loaded so far)`);
        
        let url = `${baseUrl}?per_page=${perPage}&page=${currentPage}`;
        if (dateParam) {
          url += `&created_time=>=${dateParam}`;
        }
        
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
            thumbnailUrl,
            duration: video.duration // Duration in seconds from Vimeo API
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
      setAllVideosLoaded(videosWithAiTitles);
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
            thumbnailUrl,
            duration: video.duration // Duration in seconds from Vimeo API
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
        ['Original Title', 'AI Title', 'Duration', 'Video Link', 'Download Link'],
        ...videos.map(video => [
          video.title, 
          video.aiTitle || '', 
          formatDuration(video.duration),
          video.link, 
          video.downloadLink
        ])
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
            Video Exporter
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Export video titles and links from your Vimeo albums or Bunny.net storage to Excel files. 
            Choose your provider, enter your credentials, and export to Excel with just a few clicks.
          </p>
        </div>

        {/* Security Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <p className="font-medium mb-1">Security & Compliance Notice</p>
            <p className="text-sm">
              {getSecurityNoticeMessage(provider)}
            </p>
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
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider-select">Video Provider</Label>
              <Select value={provider} onValueChange={(value: 'vimeo' | 'bunny' | 'bunny-stream' | 'wistia' | 'vdocipher' | 'zoom') => {
                setProvider(value);
                // Clear data when switching providers
                setVideos([]);
                setAllVideosLoaded([]);
                setFolders([]);
                setBunnyCollections([]);
                setWistiaProjects([]);
                setVdocipherFolders([]);
                setSelectedFolder(null);
                setError('');
                setSuccess('');
                setLoadingFolders(false);
                setLoadingBunnyCollections(false);
                setLoadingWistiaProjects(false);
                setLoadingVdocipherFolders(false);
                setLoadingZoomRecordings(false);
                setLoading(false);
              }} data-testid="select-provider">
                <SelectTrigger>
                  <SelectValue placeholder="Choose your video provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="bunny">Bunny.net Storage</SelectItem>
                  <SelectItem value="bunny-stream">Bunny.net Stream</SelectItem>
                  <SelectItem value="wistia">Wistia</SelectItem>
                  <SelectItem value="vdocipher">VdoCipher</SelectItem>
                  <SelectItem value="zoom">Zoom Recordings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vimeo Configuration */}
            {provider === 'vimeo' && (
              <>
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
              </>
            )}

            {/* Bunny.net Storage Configuration */}
            {provider === 'bunny' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bunny-api-key">Bunny.net API Key</Label>
                  <div className="relative">
                    <Input
                      id="bunny-api-key"
                      type={showToken ? "text" : "password"}
                      value={bunnyApiKey}
                      onChange={(e) => setBunnyApiKey(e.target.value)}
                      placeholder="Enter your Bunny.net API key"
                      className="pr-10"
                      data-testid="input-bunny-api-key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      data-testid="button-toggle-bunny-token-visibility"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bunny-storage-zone">Storage Zone Name</Label>
                  <Input
                    id="bunny-storage-zone"
                    type="text"
                    value={bunnyStorageZone}
                    onChange={(e) => setBunnyStorageZone(e.target.value)}
                    placeholder="Enter your Bunny.net storage zone name"
                    data-testid="input-bunny-storage-zone"
                  />
                  <p className="text-xs text-gray-500">
                    Get your API key and storage zone from{" "}
                    <a href="https://panel.bunny.net/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Bunny.net Panel
                    </a>
                    <br />
                    Storage zone is where your videos are stored
                  </p>
                </div>
              </>
            )}

            {/* Bunny.net Stream Configuration */}
            {provider === 'bunny-stream' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bunny-stream-api-key">Bunny.net Stream API Key</Label>
                  <div className="relative">
                    <Input
                      id="bunny-stream-api-key"
                      type={showToken ? "text" : "password"}
                      value={bunnyStreamApiKey}
                      onChange={(e) => setBunnyStreamApiKey(e.target.value)}
                      placeholder="Enter your Bunny.net Stream API key"
                      className="pr-10"
                      data-testid="input-bunny-stream-api-key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      data-testid="button-toggle-bunny-stream-token-visibility"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bunny-library-id">Video Library ID</Label>
                  <Input
                    id="bunny-library-id"
                    type="text"
                    value={bunnyLibraryId}
                    onChange={(e) => setBunnyLibraryId(e.target.value)}
                    placeholder="Enter your Bunny.net Video Library ID"
                    data-testid="input-bunny-library-id"
                  />
                  <p className="text-xs text-gray-500">
                    Get your Stream API key and Library ID from{" "}
                    <a href="https://panel.bunny.net/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Bunny.net Panel → Stream
                    </a>
                    <br />
                    Library ID is where your streaming videos are stored
                  </p>
                </div>
              </>
            )}

            {/* Wistia Configuration */}
            {provider === 'wistia' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wistia-api-token">Wistia API Token</Label>
                  <div className="relative">
                    <Input
                      id="wistia-api-token"
                      type={showToken ? "text" : "password"}
                      value={wistiaApiToken}
                      onChange={(e) => setWistiaApiToken(e.target.value)}
                      placeholder="Enter your Wistia API token"
                      className="pr-10"
                      data-testid="input-wistia-api-token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      data-testid="button-toggle-wistia-token-visibility"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your API token from{" "}
                    <a href="https://wistia.com/support/developers/data-api#creating-and-managing-access-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Wistia Account Settings → API Access
                    </a>
                    <br />
                    <strong>Required permissions:</strong> Read access to projects and media
                  </p>
                </div>
              </>
            )}

            {/* VdoCipher Configuration */}
            {provider === 'vdocipher' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vdocipher-api-key">VdoCipher API Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="vdocipher-api-key"
                      type={showToken ? "text" : "password"}
                      value={vdocipherApiKey}
                      onChange={(e) => setVdocipherApiKey(e.target.value)}
                      placeholder="Enter your VdoCipher API secret key"
                      className="pr-10"
                      data-testid="input-vdocipher-api-key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      data-testid="button-toggle-vdocipher-token-visibility"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your API secret key from{" "}
                    <a href="https://www.vdocipher.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      VdoCipher Dashboard → API Keys
                    </a>
                    <br />
                    <strong>Required permissions:</strong> Video management and folder access
                  </p>
                </div>
              </>
            )}

            {/* Zoom API Input */}
            {provider === 'zoom' && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="zoom-api-key">Zoom API Key (Client ID)</Label>
                    <div className="relative">
                      <Input
                        id="zoom-api-key"
                        type={showToken ? "text" : "password"}
                        value={zoomApiKey}
                        onChange={(e) => setZoomApiKey(e.target.value)}
                        placeholder="Enter your Zoom API Key (Client ID)"
                        className="pr-10"
                        data-testid="input-zoom-api-key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        data-testid="button-toggle-zoom-token-visibility"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zoom-api-secret">Zoom API Secret (Client Secret)</Label>
                    <div className="relative">
                      <Input
                        id="zoom-api-secret"
                        type={showToken ? "text" : "password"}
                        value={zoomApiSecret}
                        onChange={(e) => setZoomApiSecret(e.target.value)}
                        placeholder="Enter your Zoom API Secret (Client Secret)"
                        className="pr-10"
                        data-testid="input-zoom-api-secret"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        data-testid="button-toggle-zoom-secret-visibility"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zoom-account-id">Zoom Account ID (Optional)</Label>
                    <Input
                      id="zoom-account-id"
                      type="text"
                      value={zoomAccountId}
                      onChange={(e) => setZoomAccountId(e.target.value)}
                      placeholder="Enter your Zoom Account ID (if required)"
                      data-testid="input-zoom-account-id"
                    />
                    <p className="text-xs text-gray-500">
                      Account ID may be required for some Server-to-Server OAuth apps. Find it in your Zoom App credentials.
                    </p>
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Create a Server-to-Server OAuth app at{" "}
                      <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Zoom Marketplace → Develop → Create App
                      </a>
                    </p>
                    <p><strong>Required scopes:</strong> cloud_recording:read:list_user_recordings:admin, cloud_recording:read:list_account_recordings:admin, cloud_recording:read:recording:admin, user:read:admin</p>
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                      <p><strong>⚠️ SCOPES NON CONFIGURATI CORRETTAMENTE!</strong></p>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li><strong>Vai al tuo Zoom app → Scopes tab</strong></li>
                        <li><strong>DESELEZIONA</strong> tutti i scope "marketplace"</li>
                        <li><strong>SELEZIONA SOLO</strong> questi 4 cloud_recording scope:</li>
                        <li className="ml-4 text-xs font-mono">cloud_recording:read:list_user_recordings:admin</li>
                        <li className="ml-4 text-xs font-mono">cloud_recording:read:list_account_recordings:admin</li>
                        <li className="ml-4 text-xs font-mono">cloud_recording:read:recording:admin</li>
                        <li className="ml-4 text-xs font-mono">user:read:admin</li>
                        <li><strong>SALVA</strong> e <strong>ATTIVA</strong> l'app!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Load Videos Button */}
            {provider === 'vimeo' && (
              <>
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
              </>
            )}

            {/* Bunny.net Storage Load Button */}
            {provider === 'bunny' && (
              <div className="space-y-2">
                <Button
                  onClick={fetchAllVideos}
                  disabled={loading || !bunnyApiKey.trim() || !bunnyStorageZone.trim()}
                  className="w-full"
                  data-testid="button-load-bunny-videos"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading Videos...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Load Videos from Bunny.net Storage
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500">
                  Load all videos from your Bunny.net storage zone
                </p>
              </div>
            )}

            {/* Bunny.net Stream Buttons */}
            {provider === 'bunny-stream' && (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={fetchBunnyCollections}
                      disabled={loadingBunnyCollections || !bunnyStreamApiKey.trim() || !bunnyLibraryId.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-bunny-collections"
                    >
                      {loadingBunnyCollections ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Folder className="h-4 w-4 mr-2" />
                          Load Collections
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={fetchAllVideos}
                      disabled={loading || !bunnyStreamApiKey.trim() || !bunnyLibraryId.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-bunny-stream-videos"
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
                    Load collections OR load all videos directly from your Bunny.net Stream library
                  </p>
                </div>
              </>
            )}

            {/* Wistia Buttons */}
            {provider === 'wistia' && (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={fetchWistiaProjects}
                      disabled={loadingWistiaProjects || !wistiaApiToken.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-wistia-projects"
                    >
                      {loadingWistiaProjects ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                          Loading...
                        </>
                      ) : (
                        <>
                          <Folder className="h-4 w-4 mr-2" />
                          Load Projects
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={fetchAllVideos}
                      disabled={loading || !wistiaApiToken.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-wistia-videos"
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
                    Load projects OR load all videos directly from your Wistia account
                  </p>
                </div>
              </>
            )}

            {/* VdoCipher Buttons */}
            {provider === 'vdocipher' && (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={fetchVdocipherFolders}
                      disabled={loadingVdocipherFolders || !vdocipherApiKey.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-vdocipher-folders"
                    >
                      {loadingVdocipherFolders ? (
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
                      disabled={loading || !vdocipherApiKey.trim()}
                      variant="outline"
                      className="w-full"
                      data-testid="button-load-vdocipher-videos"
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
                    Load folders OR load all videos directly from your VdoCipher account
                  </p>
                </div>
              </>
            )}

            {/* Zoom Buttons */}
            {provider === 'zoom' && (
              <>
                <div className="space-y-2">
                  <Button
                    onClick={fetchAllVideos}
                    disabled={loading || !zoomApiKey.trim() || !zoomApiSecret.trim()}
                    variant="outline"
                    className="w-full"
                    data-testid="button-load-zoom-recordings"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4 mr-2" />
                        Load All Recordings
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Load all your Zoom cloud recordings from your account
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Folder/Collection/Project Selection - For Vimeo, Bunny Stream, Wistia, and VdoCipher */}
        {((provider === 'vimeo' && folders.length > 0) || 
          (provider === 'bunny-stream' && bunnyCollections.length > 0) ||
          (provider === 'wistia' && wistiaProjects.length > 0) ||
          (provider === 'vdocipher' && vdocipherFolders.length > 0)) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-gray-600" />
                {provider === 'vimeo' ? 'Select Folder' : 
                 provider === 'bunny-stream' ? 'Select Collection' : 
                 provider === 'wistia' ? 'Select Project' : 
                 'Select Folder'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="folder-select">
                  {provider === 'vimeo' ? 'Select Folder' : 
                   provider === 'bunny-stream' ? 'Select Collection' : 
                   provider === 'wistia' ? 'Select Project' : 
                   'Select Folder'}
                </Label>
                <Select onValueChange={(value) => {
                  const foldersList = provider === 'vimeo' ? folders : 
                                     provider === 'bunny-stream' ? bunnyCollections : 
                                     wistiaProjects;
                  const folder = foldersList.find(f => f.uri === value);
                  setSelectedFolder(folder || null);
                  setVideos([]); // Clear videos when folder changes
                  setError('');
                  setSuccess('');
                }} data-testid="select-folder">
                  <SelectTrigger>
                    <SelectValue placeholder={`Choose a ${provider === 'vimeo' ? 'folder' : 
                                                       provider === 'bunny-stream' ? 'collection' : 
                                                       'project'} to export videos from`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(provider === 'vimeo' ? folders : 
                      provider === 'bunny-stream' ? bunnyCollections : 
                      provider === 'wistia' ? wistiaProjects :
                      vdocipherFolders).map((folder) => (
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
                  {selectedFolder ? `Selected: ${selectedFolder.name}` : 
                   `Select a ${provider === 'vimeo' ? 'folder' : 
                              provider === 'bunny-stream' ? 'collection' : 
                              'project'} to continue`}
                </p>
              </div>

              {/* Fetch Videos Button */}
              {selectedFolder && (
                <Button
                  onClick={provider === 'vimeo' ? fetchVideos : 
                           provider === 'bunny-stream' ? fetchBunnyStreamVideos : 
                           provider === 'wistia' ? fetchWistiaVideos :
                           fetchVdocipherVideos}
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
        )}

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

        {/* Search and Filters - Only show when videos are loaded via "Load All Videos" */}
        {allVideosLoaded.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-600" />
                Ricerca e Filtri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search Input */}
                <div className="space-y-2">
                  <Label htmlFor="search-videos">Search by name</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="search-videos"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search videos by title..."
                      className="pl-10"
                      data-testid="input-search-videos"
                    />
                  </div>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="date-filter">Filter by date</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter} data-testid="select-date-filter">
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All videos</SelectItem>
                      <SelectItem value="1month">Last month</SelectItem>
                      <SelectItem value="3months">Last 3 months</SelectItem>
                      <SelectItem value="6months">Last 6 months</SelectItem>
                      <SelectItem value="1year">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Refresh with new date filter */}
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    onClick={fetchAllVideos}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                    data-testid="button-apply-date-filter"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Apply Date Filter
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
                <span>
                  Showing {videos.length} of {allVideosLoaded.length} videos
                  {searchQuery && ` • Search: "${searchQuery}"`}
                  {dateFilter !== 'all' && ` • Period: ${
                    dateFilter === '1month' ? 'Last month' :
                    dateFilter === '3months' ? 'Last 3 months' :
                    dateFilter === '6months' ? 'Last 6 months' :
                    dateFilter === '1year' ? 'Last year' : ''
                  }`}
                </span>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    data-testid="button-clear-search"
                  >
                    Cancella ricerca
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
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
                          Unlock AI
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg" data-testid="dialog-unlock-ai">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Unlock AI Functions
                          </DialogTitle>
                          <DialogDescription>
                            Scegli come sbloccare le funzioni AI: con password o con la tua API key OpenAI personale.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* Unlock Method Selection */}
                          <div className="space-y-3">
                            <Label>Metodo di sblocco</Label>
                            <div className="grid grid-cols-1 gap-3">
                              <div 
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                  unlockMethod === 'password' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => setUnlockMethod('password')}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`w-4 h-4 rounded-full border-2 ${
                                    unlockMethod === 'password' 
                                      ? 'border-blue-500 bg-blue-500' 
                                      : 'border-gray-300'
                                  }`}>
                                    {unlockMethod === 'password' && (
                                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium">Use System Password</div>
                                    <div className="text-sm text-gray-500">Utilizza il credito OpenAI del sistema</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div 
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                  unlockMethod === 'api-key' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => setUnlockMethod('api-key')}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`w-4 h-4 rounded-full border-2 ${
                                    unlockMethod === 'api-key' 
                                      ? 'border-blue-500 bg-blue-500' 
                                      : 'border-gray-300'
                                  }`}>
                                    {unlockMethod === 'api-key' && (
                                      <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium">Usa la Tua API Key OpenAI</div>
                                    <div className="text-sm text-gray-500">Utilizza il tuo credito OpenAI personale</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Password Input */}
                          {unlockMethod === 'password' && (
                            <div className="space-y-2">
                              <Label htmlFor="unlock-password">Password</Label>
                              <Input
                                id="unlock-password"
                                type="password"
                                value={unlockPassword}
                                onChange={(e) => setUnlockPassword(e.target.value)}
                                placeholder="Enter password"
                                onKeyDown={(e) => e.key === 'Enter' && unlockAi()}
                                data-testid="input-unlock-password"
                              />
                            </div>
                          )}

                          {/* API Key Input */}
                          {unlockMethod === 'api-key' && (
                            <div className="space-y-2">
                              <Label htmlFor="unlock-api-key">OpenAI API Key</Label>
                              <Input
                                id="unlock-api-key"
                                type="password"
                                value={userOpenAiKey}
                                onChange={(e) => setUserOpenAiKey(e.target.value)}
                                placeholder="sk-..."
                                onKeyDown={(e) => e.key === 'Enter' && unlockAi()}
                                data-testid="input-unlock-api-key"
                              />
                              <p className="text-xs text-gray-500">
                                La tua API key viene utilizzata solo per questa sessione e non viene salvata.
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button onClick={unlockAi} className="flex-1" data-testid="button-confirm-unlock">
                              <Unlock className="h-4 w-4 mr-2" />
                              Unlock
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setShowUnlockDialog(false);
                                setUnlockPassword('');
                                setUserOpenAiKey('');
                                setUnlockMethod('password');
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
                          Generating... ({bulkProgress.processed}/{bulkProgress.total})
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate All AI Titles
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
                    <p className="font-medium mb-1">Protected AI Functions</p>
                    <p className="text-sm">AI functions are password protected. Click "Unlock AI" to access automatic title generation.</p>
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
                      <TableHead>Original Title</TableHead>
                      <TableHead>AI Title</TableHead>
                      <TableHead>Duration</TableHead>
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
                            <>
                              <div className="flex flex-col gap-1">
                                {video.thumbnailUrl ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => extractAiTitle(video)}
                                    disabled={aiAnalyzing.has(video.videoId!)}
                                    className="flex items-center gap-1 h-8 px-2"
                                    data-testid={`button-ai-title-${index}`}
                                  >
                                    {aiAnalyzing.has(video.videoId!) ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="text-xs">Generating...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3" />
                                        <span className="text-xs">AI Title</span>
                                      </>
                                    )}
                                  </Button>
                                ) : provider === 'bunny-stream' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => regenerateThumbnail(video)}
                                    disabled={aiAnalyzing.has(video.videoId!)}
                                    className="flex items-center gap-1 h-8 px-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                                    data-testid={`button-regenerate-thumbnail-${index}`}
                                  >
                                    <Video className="h-3 w-3" />
                                    <span className="text-xs">Gen Thumb</span>
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>No Thumbnail</span>
                                  </div>
                                )}
                                {provider === 'bunny-stream' && (
                                  <div className="text-xs text-gray-400">
                                    {video.thumbnailUrl ? '🟢 Has thumb' : '🔴 No thumb'}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Lock className="h-3 w-3" />
                              <span>AI Bloccata</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-duration-${index}`}>
                          <span className="text-gray-600 font-mono text-sm">
                            {formatDuration(video.duration)}
                          </span>
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
                                  <span className="text-xs">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span className="text-xs">Copy</span>
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
                                    <span className="text-xs">Copied!</span>
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

        {/* Instructions - Dynamic based on provider */}
        <Alert className="mt-8 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              How to Use This App - 6 Providers Supported!
            </h3>
            <div className="text-blue-800 space-y-2 text-sm">
              {provider === 'vimeo' && (
                <ol className="space-y-2 list-decimal list-inside">
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
              )}

              {provider === 'bunny' && (
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Get your Bunny.net API key from{" "}
                    <a href="https://dash.bunny.net/account/settings" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Bunny.net Dashboard → Account Settings
                    </a>
                  </li>
                  <li>
                    Enter your <strong>Storage Zone name</strong> (where your video files are stored)
                  </li>
                  <li>Enter your API key and Storage Zone, then click "Load Videos from Bunny.net Storage"</li>
                  <li>The app will scan for common video file formats (mp4, avi, mov, etc.)</li>
                  <li>Review the video list and click "Export to Excel" to download the data</li>
                  <li>
                    <strong>Note:</strong> This works with Bunny.net Storage (static files), not Bunny.net Stream
                  </li>
                </ol>
              )}

              {provider === 'bunny-stream' && (
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Get your Bunny.net Stream API key from{" "}
                    <a href="https://dash.bunny.net/video-streaming" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Bunny.net Dashboard → Video Streaming
                    </a>
                  </li>
                  <li>
                    Find your <strong>Library ID</strong> in your streaming library settings
                  </li>
                  <li>Enter your API key and Library ID, then choose one of two options:</li>
                  <li className="ml-4">
                    <strong>Option A:</strong> Click "Load Collections" → Select a collection → Click "Fetch Videos"
                  </li>
                  <li className="ml-4">
                    <strong>Option B:</strong> Click "Load All Videos" to get all videos from your library
                  </li>
                  <li>Review the video list and click "Export to Excel" to download the data</li>
                  <li>
                    <strong>Note:</strong> This works with Bunny.net Stream (video streaming), not static storage
                  </li>
                </ol>
              )}

              {provider === 'wistia' && (
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Create a Wistia API token from{" "}
                    <a href="https://wistia.com/support/developers/data-api#creating-and-managing-access-tokens" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Wistia Account Settings → API Access
                    </a>
                  </li>
                  <li>
                    <strong>Required permissions:</strong> Make sure your token has read access to projects and media
                  </li>
                  <li>Enter your API token and choose one of two options:</li>
                  <li className="ml-4">
                    <strong>Option A:</strong> Click "Load Projects" → Select a project → Click "Fetch Videos"
                  </li>
                  <li className="ml-4">
                    <strong>Option B:</strong> Click "Load All Videos" to get all videos from your account
                  </li>
                  <li>Review the video list and click "Export to Excel" to download the data</li>
                  <li>
                    <strong>Tip:</strong> Wistia provides excellent thumbnail and analytics data for your videos
                  </li>
                </ol>
              )}

              {provider === 'vdocipher' && (
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Get your API secret key from{" "}
                    <a href="https://www.vdocipher.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      VdoCipher Dashboard → API Keys
                    </a>
                  </li>
                  <li>
                    <strong>Required permissions:</strong> Select "Viewer" (for reading videos and folders) and optionally "Editor" (for metadata access)
                  </li>
                  <li>Enter your API secret key and choose one of two options:</li>
                  <li className="ml-4">
                    <strong>Option A:</strong> Click "Load Folders" → Select a folder → Click "Fetch Videos"
                  </li>
                  <li className="ml-4">
                    <strong>Option B:</strong> Click "Load All Videos" to get all videos from your account
                  </li>
                  <li>Review the video list and click "Export to Excel" to download the data</li>
                  <li>
                    <strong>Tip:</strong> VdoCipher provides secure video streaming with detailed analytics and DRM protection
                  </li>
                </ol>
              )}

              {provider === 'zoom' && (
                <ol className="space-y-2 list-decimal list-inside">
                  <li>
                    Create a Server-to-Server OAuth app at{" "}
                    <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Zoom Marketplace → Develop → Create App
                    </a>
                  </li>
                  <li>
                    Select "Server-to-Server OAuth" app type for automated access without user interaction
                  </li>
                  <li>
                    <strong>Required scopes:</strong> cloud_recording:read:list_user_recordings:admin, cloud_recording:read:list_account_recordings:admin, cloud_recording:read:recording:admin, user:read:admin
                  </li>
                  <li>Copy your Client ID (API Key) and Client Secret (API Secret) from the app credentials</li>
                  <li><strong>Make sure your app is "Activated" (not just saved as draft)</strong></li>
                  <li>Enter both credentials and click "Load All Recordings" to fetch all your cloud recordings</li>
                  <li>The system will automatically try different API endpoints to find your recordings</li>
                  <li>Review the recordings list with meeting details, passwords (when available), and direct links</li>
                  <li>Click "Export to Excel" to download all recording metadata including meeting passwords</li>
                  <li>
                    <strong>Tip:</strong> Password-protected recordings show the passcode when available via API - no more hunting for meeting passwords!
                  </li>
                </ol>
              )}
            </div>
          </AlertDescription>
        </Alert>

        {/* Footer with Security Note */}
        <Alert className="mt-6 border-gray-200 bg-gray-50">
          <Shield className="h-4 w-4 text-gray-600" />
          <AlertDescription>
            <div className="text-gray-700 text-sm">
              <p className="font-medium mb-1">🔒 Privacy & Security</p>
              <p>
                Your API tokens are only used during this session and <strong>are never saved in the database</strong>. 
                When you close the app or refresh the page, all tokens are automatically cleared for your security.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Creator Footer */}
        <div className="mt-4 text-center text-gray-500 text-sm border-t pt-4">
          <p>Created by <span className="font-medium text-gray-700">Davide Volpato</span> with ❤️ - Free to use</p>
        </div>
      </div>
    </div>
  );
}
