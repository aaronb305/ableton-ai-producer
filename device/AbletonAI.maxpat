{
	"patcher" : 	{
		"fileversion" : 1,
		"appversion" : 		{
			"major" : 8,
			"minor" : 6,
			"revision" : 0,
			"architecture" : "x64",
			"modernui" : 1
		},
		"classnamespace" : "box",
		"rect" : [ 0, 0, 1100, 800 ],
		"bglocked" : 0,
		"openinpresentation" : 1,
		"default_fontsize" : 12.0,
		"default_fontface" : 0,
		"default_fontname" : "Arial",
		"gridonopen" : 1,
		"gridsize" : [ 15.0, 15.0 ],
		"gridsnaponopen" : 1,
		"objectsnaponopen" : 1,
		"statusbarvisible" : 2,
		"toolbarvisible" : 1,
		"lefttoolbarpinned" : 0,
		"toptoolbarpinned" : 0,
		"righttoolbarpinned" : 0,
		"bottomtoolbarpinned" : 0,
		"toolbars_unpinned_last_save" : 0,
		"tallnewobj" : 0,
		"boxanimatetime" : 200,
		"enablehscroll" : 1,
		"enablevscroll" : 1,
		"devicewidth" : 600,
		"description" : "AI-powered music production assistant",
		"digest" : "Multi-provider AI production assistant with chat, analysis, and sound library",
		"tags" : "AI, Claude, GPT, production, assistant, chat",
		"style" : "",
		"subpatcher_template" : "",
		"assistshowspatchername" : 0,
		"boxes" : [
			{
				"box" : 				{
					"id" : "obj-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 300.0, 350.0, 22.0 ],
					"text" : "node.script ../node/index.js @autostart 1 @watch 1"
				}
			},
			{
				"box" : 				{
					"id" : "obj-jweb",
					"maxclass" : "jweb",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 30.0, 580.0, 380.0 ],
					"presentation" : 1,
					"presentation_rect" : [ 0.0, 0.0, 600.0, 400.0 ],
					"url" : "../ui/index.html",
					"rendermode" : 0
				}
			},
			{
				"box" : 				{
					"id" : "obj-session-reader",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 300.0, 200.0, 22.0 ],
					"text" : "js ../patchers/session-reader.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-action-executor",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 370.0, 220.0, 22.0 ],
					"text" : "js ../patchers/action-executor.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 340.0, 200.0, 22.0 ],
					"text" : "route action_request"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-action-result",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 3,
					"outlettype" : [ "", "", "" ],
					"patching_rect" : [ 450.0, 410.0, 280.0, 22.0 ],
					"text" : "route action_result action_error"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-session",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 450.0, 340.0, 180.0, 22.0 ],
					"text" : "route session_state"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-ar",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 450.0, 130.0, 22.0 ],
					"text" : "prepend action_result"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-session-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 480.0, 140.0, 22.0 ],
					"text" : "prepend session_state"
				}
			},
			{
				"box" : 				{
					"id" : "obj-loadbang",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 550.0, 260.0, 60.0, 22.0 ],
					"text" : "loadbang"
				}
			},
			{
				"box" : 				{
					"id" : "obj-delay-init",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 550.0, 280.0, 70.0, 22.0 ],
					"text" : "delay 3000"
				}
			},
			{
				"box" : 				{
					"id" : "obj-library-indexer",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 700.0, 300.0, 220.0, 22.0 ],
					"text" : "js ../patchers/library-indexer.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-library",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 4,
					"outlettype" : [ "", "", "", "" ],
					"patching_rect" : [ 700.0, 340.0, 280.0, 22.0 ],
					"text" : "route library_index scan_progress scan_error"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-library-index",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 700.0, 380.0, 140.0, 22.0 ],
					"text" : "prepend library_index"
				}
			},
			{
				"box" : 				{
					"id" : "obj-delay-scan",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 700.0, 280.0, 70.0, 22.0 ],
					"text" : "delay 5000"
				}
			},
			{
				"box" : 				{
					"id" : "obj-comment-title",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 550.0, 600.0, 20.0 ],
					"text" : "Ableton AI Producer — Simplified routing: jweb talks to server directly, node.script is thin bridge"
				}
			},
			{
				"box" : 				{
					"id" : "obj-comment-flow1",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 570.0, 700.0, 20.0 ],
					"text" : "Chat flow: jweb → HTTP/SSE → server (port 9320). Action flow: server → SSE → node.script → Max → action-executor → result → node.script → server"
				}
			},
			{
				"box" : 				{
					"id" : "obj-comment-audio",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 630.0, 600.0, 20.0 ],
					"text" : "Audio analysis: plugin~ → sigmund~/loudness~ → audio-analyzer.js → node.script → server"
				}
			},
			{
				"box" : 				{
					"id" : "obj-plugin",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 2,
					"outlettype" : [ "signal", "signal" ],
					"patching_rect" : [ 30.0, 640.0, 80.0, 22.0 ],
					"text" : "plugin~ 2 2"
				}
			},
			{
				"box" : 				{
					"id" : "obj-sigmund",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "list" ],
					"patching_rect" : [ 30.0, 670.0, 200.0, 22.0 ],
					"text" : "sigmund~ @npeak 5 @minpower 40"
				}
			},
			{
				"box" : 				{
					"id" : "obj-loudness",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 3,
					"outlettype" : [ "float", "float", "float" ],
					"patching_rect" : [ 200.0, 670.0, 150.0, 22.0 ],
					"text" : "loudness~ @interval 200"
				}
			},
			{
				"box" : 				{
					"id" : "obj-metro-analysis",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 400.0, 640.0, 70.0, 22.0 ],
					"text" : "metro 500"
				}
			},
			{
				"box" : 				{
					"id" : "obj-audio-analyzer",
					"maxclass" : "newobj",
					"numinlets" : 3,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 30.0, 710.0, 240.0, 22.0 ],
					"text" : "js ../patchers/audio-analyzer.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-analysis",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 740.0, 180.0, 22.0 ],
					"text" : "route analysis_data"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-analysis",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 30.0, 770.0, 150.0, 22.0 ],
					"text" : "prepend audio_analysis"
				}
			},
			{
				"box" : 				{
					"id" : "obj-live-observer",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 3,
					"outlettype" : [ "", "", "" ],
					"patching_rect" : [ 400.0, 610.0, 200.0, 22.0 ],
					"text" : "live.observer @property is_playing @type property @path live_set"
				}
			},
			{
				"box" : 				{
					"id" : "obj-gate-analysis",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 400.0, 640.0, 40.0, 22.0 ],
					"text" : "gate"
				}
			},
			{
				"box" : 				{
					"id" : "obj-pack-loudness",
					"maxclass" : "newobj",
					"numinlets" : 3,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 200.0, 700.0, 160.0, 22.0 ],
					"text" : "pack 0. 0. 0."
				}
			}
		],
		"lines" : [
			{
				"patchline" : 				{
					"source" : [ "obj-node", 0 ],
					"destination" : [ "obj-route-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 0 ],
					"destination" : [ "obj-action-executor", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-session-reader", 0 ],
					"destination" : [ "obj-route-session", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-session", 0 ],
					"destination" : [ "obj-prepend-session-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-session-node", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-action-executor", 0 ],
					"destination" : [ "obj-route-action-result", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-action-result", 0 ],
					"destination" : [ "obj-prepend-ar", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-ar", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loadbang", 0 ],
					"destination" : [ "obj-delay-init", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-delay-init", 0 ],
					"destination" : [ "obj-session-reader", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loadbang", 0 ],
					"destination" : [ "obj-delay-scan", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-delay-scan", 0 ],
					"destination" : [ "obj-library-indexer", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-library-indexer", 0 ],
					"destination" : [ "obj-route-library", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-library", 0 ],
					"destination" : [ "obj-prepend-library-index", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-library-index", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-plugin", 0 ],
					"destination" : [ "obj-sigmund", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-plugin", 0 ],
					"destination" : [ "obj-loudness", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-plugin", 1 ],
					"destination" : [ "obj-loudness", 1 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-sigmund", 0 ],
					"destination" : [ "obj-audio-analyzer", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loudness", 0 ],
					"destination" : [ "obj-pack-loudness", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loudness", 1 ],
					"destination" : [ "obj-pack-loudness", 1 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loudness", 2 ],
					"destination" : [ "obj-pack-loudness", 2 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-pack-loudness", 0 ],
					"destination" : [ "obj-audio-analyzer", 1 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-live-observer", 0 ],
					"destination" : [ "obj-gate-analysis", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-gate-analysis", 0 ],
					"destination" : [ "obj-metro-analysis", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-metro-analysis", 0 ],
					"destination" : [ "obj-audio-analyzer", 2 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-audio-analyzer", 0 ],
					"destination" : [ "obj-route-analysis", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-analysis", 0 ],
					"destination" : [ "obj-prepend-analysis", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-analysis", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			}
		]
	}
}
